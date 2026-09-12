// Frozen d649836 legacy verifier body: proves actual old Worker rejection of v2 claims.
import {jwtVerify} from 'jose';
import {it,expect} from 'vitest';
import {MAX_ROOM_ID_CHARS,MAX_PARTICIPANT_ID_CHARS,MAX_SESSION_ID_CHARS,MAX_DISPLAY_NAME_CHARS,MAX_URL_CHARS,ROOM_TOKEN_ISSUER,ROOM_TOKEN_AUDIENCE,RoomCapabilitiesSchema} from '@anidachi/protocol';
import {verifyRoomToken,signRoomTokenForTest,type WorkerAuthEnv,type VerifiedRoomToken} from '../src/auth';
const env={ANIDACHI_JWT_SECRET:'test-v2-compat-secret'};
function getSecret(env:WorkerAuthEnv){return new TextEncoder().encode(env.ANIDACHI_JWT_SECRET);}
async function legacyVerifyRoomToken(
  token: string,
  expectedRoomId: string,
  env: WorkerAuthEnv,
): Promise<VerifiedRoomToken | null> {
  try {
    if (!isBoundedId(expectedRoomId, MAX_ROOM_ID_CHARS)) return null;
    const { payload } = await jwtVerify(token, getSecret(env), {
      algorithms: ["HS256"],
      issuer: ROOM_TOKEN_ISSUER,
      audience: ROOM_TOKEN_AUDIENCE,
      requiredClaims: ["sub", "iat", "exp"],
    });
    if (payload.typ !== "room") return null;
    if (!isBoundedId(payload.sub, MAX_PARTICIPANT_ID_CHARS)) return null;
    if (!isBoundedId(payload.roomId, MAX_ROOM_ID_CHARS) || payload.roomId !== expectedRoomId) {
      return null;
    }
    if (payload.role !== "host" && payload.role !== "member") return null;
    if (!isBoundedId(payload.participantSessionId, MAX_SESSION_ID_CHARS)) return null;
    const capabilities =
      payload.capabilities === undefined
        ? undefined
        : RoomCapabilitiesSchema.safeParse(payload.capabilities);
    if (capabilities !== undefined && !capabilities.success) return null;
    if (
      payload.displayName !== undefined &&
      !isBoundedId(payload.displayName, MAX_DISPLAY_NAME_CHARS)
    ) {
      return null;
    }
    if (
      payload.avatarUrl !== null &&
      payload.avatarUrl !== undefined &&
      !isBoundedUrl(payload.avatarUrl)
    ) {
      return null;
    }

    const verified: VerifiedRoomToken = {
      sub: payload.sub,
      roomId: payload.roomId,
      role: payload.role,
      participantSessionId: payload.participantSessionId,
      avatarUrl: payload.avatarUrl ?? null,
    };
    if (capabilities?.data) {
      verified.capabilities = capabilities.data;
    }
    if (payload.displayName) {
      verified.displayName = payload.displayName;
    }

    return verified;
  } catch {
    return null;
  }
}

function isBoundedId(value: unknown, maxChars: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxChars;
}

function isBoundedUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_URL_CHARS &&
    URL.canParse(value)
  );
}


it('new strict capability claim is accepted by new Worker and rejected by actual legacy verifier',async()=>{
 const now=Date.now();
 const lease={roomId:'room',roomGeneration:1,issuedAt:new Date(now).toISOString(),paidUntil:null,capabilities:{mediaProtocolVersion:2 as const,hostPlanCode:'pro' as const,maxParticipants:15 as const,maxCameras:4 as const,maxMicrophones:8 as const,capabilityRevision:1,capabilitiesValidUntil:new Date(now+1800000).toISOString()}};
 const token=await signRoomTokenForTest({roomId:'room',sub:'host',hostUserId:'host',participantSessionId:'session',role:'host',mediaLease:lease},env);
 expect(await legacyVerifyRoomToken(token,'room',env)).toBeNull();
 expect(await verifyRoomToken(token,'room',env)).toMatchObject({hostUserId:'host',mediaLease:lease});
 const wrongHost=await signRoomTokenForTest({roomId:'room',sub:'host',hostUserId:'other',participantSessionId:'session',role:'host',mediaLease:lease},env);
 expect(await verifyRoomToken(wrongHost,'room',env)).toBeNull();
 const legacy=await signRoomTokenForTest({roomId:'room',sub:'host',participantSessionId:'session',role:'host'},env);
 expect(await legacyVerifyRoomToken(legacy,'room',env)).not.toBeNull();expect(await verifyRoomToken(legacy,'room',env)).not.toBeNull();
});
