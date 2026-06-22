/* save_crypto.js - 暗号化セーブ出力/読込 */
(function () {
    'use strict';

    const FORMAT = 'PRISMA_ABYSS_RPGSAVE';
    const VERSION = 1;
    const DEFAULT_COMPRESSION = 'gzip';
    const FALLBACK_COMPRESSION = 'lzw32';
    const KDF_ITERATIONS = 120000;

    // サーバー管理前の簡易的な改ざん抑止用固定パスフレーズ。
    // クライアント配布物に含まれるため、本格的な不正防止用途には使わないこと。
    const SAVE_PASSPHRASE = 'PRISMA_ABYSS_LOCAL_SAVE_EXPORT_V1_2026';

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    const toBase64Url = (bytes) => {
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    };

    const fromBase64Url = (text) => {
        const normalized = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    };

    const cryptoApi = () => {
        const c = (typeof globalThis !== 'undefined') ? globalThis.crypto : null;
        if (!c || !c.subtle || typeof c.getRandomValues !== 'function') {
            throw new Error('この環境では暗号化セーブを利用できません。https:// または http://localhost で起動してください。');
        }
        return c;
    };

    const randomBytes = (length) => {
        const bytes = new Uint8Array(length);
        cryptoApi().getRandomValues(bytes);
        return bytes;
    };

    const deriveKey = async (saltBytes, iterations) => {
        const subtle = cryptoApi().subtle;
        const material = await subtle.importKey(
            'raw',
            textEncoder.encode(SAVE_PASSPHRASE),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        return subtle.deriveKey(
            { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: iterations || KDF_ITERATIONS },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    };

    const blobToUint8Array = async (blob) => new Uint8Array(await blob.arrayBuffer());

    const gzipCompress = async (bytes) => {
        if (typeof CompressionStream === 'undefined') throw new Error('CompressionStream unavailable');
        const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
        return blobToUint8Array(await new Response(stream).blob());
    };

    const gzipDecompress = async (bytes) => {
        if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream unavailable');
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        return blobToUint8Array(await new Response(stream).blob());
    };

    // CompressionStream が使えない環境向けの小さなLZWフォールバック。
    // UTF-8化したバイト列を対象にし、コードはUint32 little-endianで保存する。
    const lzwCompress = (bytes) => {
        if (!bytes || bytes.length === 0) return new Uint8Array(0);
        const dict = new Map();
        for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);

        let phrase = String.fromCharCode(bytes[0]);
        let code = 256;
        const out = [];

        for (let i = 1; i < bytes.length; i++) {
            const curr = String.fromCharCode(bytes[i]);
            const combined = phrase + curr;
            if (dict.has(combined)) {
                phrase = combined;
            } else {
                out.push(dict.get(phrase));
                dict.set(combined, code++);
                phrase = curr;
            }
        }
        out.push(dict.get(phrase));

        const result = new Uint8Array(out.length * 4);
        const view = new DataView(result.buffer);
        out.forEach((value, index) => view.setUint32(index * 4, value, true));
        return result;
    };

    const lzwDecompress = (bytes) => {
        if (!bytes || bytes.length === 0) return new Uint8Array(0);
        if (bytes.length % 4 !== 0) throw new Error('Invalid LZW payload');

        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const codes = [];
        for (let i = 0; i < bytes.length; i += 4) codes.push(view.getUint32(i, true));
        if (codes.length === 0) return new Uint8Array(0);

        const dict = new Map();
        for (let i = 0; i < 256; i++) dict.set(i, String.fromCharCode(i));

        let oldPhrase = dict.get(codes[0]);
        if (oldPhrase === undefined) throw new Error('Invalid LZW first code');
        const out = [oldPhrase];
        let currChar = oldPhrase.charAt(0);
        let code = 256;

        for (let i = 1; i < codes.length; i++) {
            const currCode = codes[i];
            let phrase;
            if (dict.has(currCode)) {
                phrase = dict.get(currCode);
            } else if (currCode === code) {
                phrase = oldPhrase + currChar;
            } else {
                throw new Error('Invalid LZW code');
            }
            out.push(phrase);
            currChar = phrase.charAt(0);
            dict.set(code++, oldPhrase + currChar);
            oldPhrase = phrase;
        }

        const binary = out.join('');
        const result = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i) & 0xff;
        return result;
    };

    const compress = async (bytes) => {
        try {
            return { codec: DEFAULT_COMPRESSION, bytes: await gzipCompress(bytes) };
        } catch (e) {
            return { codec: FALLBACK_COMPRESSION, bytes: lzwCompress(bytes) };
        }
    };

    const decompress = async (codec, bytes) => {
        if (codec === DEFAULT_COMPRESSION) return gzipDecompress(bytes);
        if (codec === FALLBACK_COMPRESSION) return lzwDecompress(bytes);
        throw new Error('未対応の圧縮形式です');
    };

    const encryptBytes = async (plainBytes) => {
        const salt = randomBytes(16);
        const iv = randomBytes(12);
        const key = await deriveKey(salt, KDF_ITERATIONS);
        const encrypted = await cryptoApi().subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBytes);
        return { salt, iv, encrypted: new Uint8Array(encrypted) };
    };

    const decryptBytes = async (wrapper) => {
        const kdf = wrapper.kdf || {};
        const cipher = wrapper.cipher || {};
        const salt = fromBase64Url(kdf.salt);
        const iv = fromBase64Url(cipher.iv);
        const payload = fromBase64Url(wrapper.payload);
        const key = await deriveKey(salt, kdf.iterations || KDF_ITERATIONS);
        const decrypted = await cryptoApi().subtle.decrypt({ name: 'AES-GCM', iv }, key, payload);
        return new Uint8Array(decrypted);
    };

    const normalizeJsonText = (text) => String(text || '').replace(/^\uFEFF/, '').trim();

    const encodeSaveData = async (saveData) => {
        const json = JSON.stringify(saveData);
        const rawBytes = textEncoder.encode(json);
        const compressed = await compress(rawBytes);
        const encrypted = await encryptBytes(compressed.bytes);

        return JSON.stringify({
            format: FORMAT,
            version: VERSION,
            app: 'PRISMA ABYSS',
            createdAt: new Date().toISOString(),
            compression: compressed.codec,
            kdf: {
                name: 'PBKDF2',
                hash: 'SHA-256',
                iterations: KDF_ITERATIONS,
                salt: toBase64Url(encrypted.salt)
            },
            cipher: {
                name: 'AES-GCM',
                iv: toBase64Url(encrypted.iv)
            },
            payload: toBase64Url(encrypted.encrypted)
        }, null, 2);
    };

    const decodeEncryptedWrapper = async (wrapper) => {
        if (!wrapper || wrapper.format !== FORMAT) throw new Error('Unsupported save format');
        if (wrapper.version !== VERSION) throw new Error('未対応のセーブファイルバージョンです');
        if (!wrapper.payload || !wrapper.kdf || !wrapper.cipher) throw new Error('セーブファイルの情報が不足しています');

        const compressedBytes = await decryptBytes(wrapper);
        const rawBytes = await decompress(wrapper.compression, compressedBytes);
        return JSON.parse(textDecoder.decode(rawBytes));
    };

    const decodeSaveText = async (text) => {
        const normalized = normalizeJsonText(text);
        if (!normalized) throw new Error('空のファイルです');

        const parsed = JSON.parse(normalized);
        if (parsed && parsed.format === FORMAT) {
            return { data: await decodeEncryptedWrapper(parsed), encrypted: true, legacy: false };
        }
        return { data: parsed, encrypted: false, legacy: true };
    };

    const buildFileName = () => {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = [
            d.getFullYear(),
            pad(d.getMonth() + 1),
            pad(d.getDate()),
            '_',
            pad(d.getHours()),
            pad(d.getMinutes()),
            pad(d.getSeconds())
        ].join('');
        return `rpg_save_${stamp}.rpgsave`;
    };

    window.SaveCrypto = {
        FORMAT,
        VERSION,
        encodeSaveData,
        decodeSaveText,
        buildFileName
    };
})();
