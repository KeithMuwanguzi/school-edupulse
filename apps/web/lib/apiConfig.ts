/** API base URL — must match docker-compose host port (5330) when using Docker API. */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5330/api/v1";
