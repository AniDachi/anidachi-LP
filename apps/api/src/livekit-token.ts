import { SignJWT } from "jose";

export interface LiveKitTokenInput {
  apiKey: string;
  apiSecret: string;
  roomId: string;
  identity: string;
  name: string;
}

export async function createLiveKitToken(input: LiveKitTokenInput): Promise<string> {
  const secret = new TextEncoder().encode(input.apiSecret);

  return new SignJWT({
    name: input.name,
    video: {
      room: input.roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(input.apiKey)
    .setSubject(input.identity)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}
