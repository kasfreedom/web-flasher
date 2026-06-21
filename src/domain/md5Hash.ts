import SparkMD5 from "spark-md5";

export function calculateMd5Hex(data: Uint8Array): string {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);

  return SparkMD5.ArrayBuffer.hash(copy.buffer);
}
