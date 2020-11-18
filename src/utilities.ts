export function getDataByteSize(data: any): number {
  try {
    return Buffer.byteLength(
      typeof data === "string" ? data : JSON.stringify(data) || "",
      "utf8"
    );
  } catch {
    return 0;
  }
}
