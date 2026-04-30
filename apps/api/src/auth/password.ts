import {
  randomBytes,
  scrypt as scryptCallback,
  scryptSync,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const keyLength = 64;
const saltLength = 16;
const scryptParams = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
} as const;

export const dummyPasswordHash = encodeV1PasswordHash(
  "kreps-login-timing-dummy-salt-v1",
  scryptSync("kreps-login-timing-dummy-password", "kreps-login-timing-dummy-salt-v1", keyLength, scryptOptions()),
);

export async function hashPassword(password: string) {
  const salt = randomBytes(saltLength).toString("base64url");
  const derived = await derivePasswordKey(password, salt);

  return encodeV1PasswordHash(salt, derived);
}

export async function verifyPassword(password: string, storedHash: string) {
  try {
    const parts = storedHash.split("$");
    if (parts[0] !== "scrypt") return false;

    if (parts[1] === "v1") {
      return verifyV1Password(password, parts);
    }

    return verifyLegacySeedPassword(password, parts);
  } catch {
    return false;
  }
}

async function verifyV1Password(password: string, parts: string[]) {
  if (parts.length !== 8) return false;

  const [, , cost, blockSize, parallelization, encodedKeyLength, salt, expectedHash] = parts;
  if (!cost || !blockSize || !parallelization || !encodedKeyLength || !salt || !expectedHash) return false;

  const parsedCost = parseScryptCost(cost);
  const parsedBlockSize = parseScryptParameter(blockSize, 64);
  const parsedParallelization = parseScryptParameter(parallelization, 16);
  const parsedKeyLength = parseScryptParameter(encodedKeyLength, 128);
  if (!parsedCost || !parsedBlockSize || !parsedParallelization || !parsedKeyLength) return false;

  const actual = await derivePasswordKey(password, salt, parsedKeyLength, {
    N: parsedCost,
    r: parsedBlockSize,
    p: parsedParallelization,
  });
  return timingSafeStringEqual(actual.toString("base64url"), expectedHash);
}

async function verifyLegacySeedPassword(password: string, parts: string[]) {
  if (parts.length !== 3) return false;

  const [, salt, expectedHash] = parts;
  if (!salt || !expectedHash) return false;

  const actual = await derivePasswordKey(password, salt, keyLength);
  return timingSafeStringEqual(actual.toString("hex"), expectedHash);
}

async function derivePasswordKey(password: string, salt: string, length = keyLength, options: ScryptOptions = scryptOptions()) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function encodeV1PasswordHash(salt: string, derived: Buffer) {
  return [
    "scrypt",
    "v1",
    scryptParams.cost,
    scryptParams.blockSize,
    scryptParams.parallelization,
    keyLength,
    salt,
    derived.toString("base64url"),
  ].join("$");
}

function scryptOptions(): ScryptOptions {
  return {
    N: scryptParams.cost,
    r: scryptParams.blockSize,
    p: scryptParams.parallelization,
  };
}

function parseScryptCost(value: string) {
  const cost = Number(value);
  if (!Number.isInteger(cost) || cost < 2 || cost > 2 ** 20) return null;
  return cost > 0 && (cost & (cost - 1)) === 0 ? cost : null;
}

function parseScryptParameter(value: string, max: number) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) return null;
  return number;
}

function timingSafeStringEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.byteLength !== expectedBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
