# LiveKit and AWS Infrastructure Notes

Research date: 2026-06-02

Status: historical infrastructure research. The current default media direction
is WebRTC P2P with Cloudflare TURN fallback. Do not treat this file as the active
media implementation plan unless the team explicitly decides to bring LiveKit
back as an SFU layer.

## Core Decision

LiveKit should not be the source of truth for Anidachi rooms.

Anidachi rooms are product rooms:

- created by Anidachi backend;
- stored in Supabase/Postgres;
- coordinated in Cloudflare Durable Objects;
- connected to a video source, invite, host, participants, and permissions.

LiveKit rooms are media rooms only:

- camera tracks;
- optional push-to-talk audio tracks;
- active speaker information;
- no movie/video content;
- no durable business state.

## Target Room Flow

```txt
Extension
  create room / join room

Anidachi API
  verifies user
  creates/loads Supabase room
  verifies room membership
  creates/loads Durable Object room
  issues LiveKit participant token

Durable Object
  playback sync
  realtime reactions
  presence
  live room state

LiveKit
  Ghost Cam video
  optional push-to-talk voice
```

## Recommended First Self-Hosted Setup

For early production/staging, use one AWS EC2 VM before introducing Kubernetes.

Recommended shape:

```txt
AWS EC2
Ubuntu 24.04 LTS
Docker Compose
Elastic IP
livekit.anidachi.app
turn.anidachi.app
```

Recommended first instance:

```txt
Region: closest to first users, likely eu-central-1 for Europe/Ukraine
Instance: c7i.xlarge / c8i.xlarge for first staging
Scale-up: c7i.2xlarge, c7i.4xlarge, then multiple nodes
Disk: 40-80 GB gp3
```

Avoid burstable instances such as `t3`/`t4g` for production media traffic.
Realtime SFU traffic benefits from predictable CPU and network performance.

## Ports

AWS Security Group should allow:

```txt
80 TCP             certificate challenge / redirect
443 TCP            HTTPS/WSS/TURN TLS depending on setup
7881 TCP           WebRTC TCP fallback
3478 UDP           TURN UDP
50000-60000 UDP    WebRTC UDP media
```

Exact public ports depend on whether LiveKit is exposed directly, behind Caddy,
or behind AWS Network Load Balancer.

## Single Node LiveKit Config Shape

```yaml
port: 7880
log_level: info

rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true

turn:
  enabled: true
  domain: turn.anidachi.app
  tls_port: 443
  udp_port: 3478

keys:
  anidachi_prod_key: <secret>
```

For multi-node deployment, add Redis:

```yaml
redis:
  address: <elasticache-redis-endpoint>:6379
```

## Scaling Strategy

Phase 1: LiveKit Cloud

- best for current product iteration;
- no ops burden;
- useful while auth, rooms, friends, and product UX are still changing.

Phase 2: one AWS EC2 self-hosted LiveKit staging

- validates deployment, TLS, TURN, token flow, and real user traffic;
- enough for early experiments and controlled external tests.

Phase 3: several EC2 nodes + Redis + AWS Network Load Balancer

- needed when concurrency grows;
- Redis lets LiveKit coordinate distributed room state;
- NLB can expose TCP/UDP media ports.

Phase 4: multi-region

- use Route53 latency routing or AWS Global Accelerator;
- each room should still be placed in one LiveKit region/node;
- multi-region helps users connect to a nearby room, but does not make one room
  globally distributed by itself.

## Important Constraints

- LiveKit API keys and secrets must never be in the extension.
- LiveKit tokens must be short-lived and issued by Anidachi backend only.
- Token endpoint must verify:
  - authenticated user;
  - room exists;
  - user is room member;
  - requested room id matches the token room.
- LiveKit identity should be the verified Anidachi user id.
- Movie/video content is never sent through LiveKit.

## Cost Principle

For Anidachi, the main scaling cost is expected to be outbound bandwidth, not CPU.

Ghost Cam is low-resolution, but SFU bandwidth grows with participants:

```txt
outbound media per room ~= sender_bitrate * participants * (participants - 1)
```

For 4 participants where everyone publishes one Ghost Cam stream:

```txt
outbound ~= stream_bitrate * 4 * 3 = stream_bitrate * 12
```

This is why low FPS, low resolution, and adaptive publishing matter.

## Cost Research Snapshot: 1000 Rooms With 4 People

Research date: 2026-06-02

Scenario:

```txt
1000 concurrent rooms
4 participants per room
4000 concurrent participants
everyone publishes one Ghost Cam video track
each participant subscribes to the other 3 participants in the room
movie/video content is not sent through LiveKit
```

Formula:

```txt
downstream bitrate = rooms * participants * (participants - 1) * per-camera-bitrate
```

For 1000 rooms and 4 participants:

```txt
downstream bitrate = 1000 * 4 * 3 * per-camera-bitrate
```

Approximate downstream traffic:

```txt
100 kbps/camera -> 0.54 TB/hour
150 kbps/camera -> 0.81 TB/hour
250 kbps/camera -> 1.35 TB/hour
400 kbps/camera -> 2.16 TB/hour
```

Approximate monthly downstream traffic if this peak runs 2 hours/day:

```txt
100 kbps/camera -> 32.4 TB/month
150 kbps/camera -> 48.6 TB/month
250 kbps/camera -> 81.0 TB/month
400 kbps/camera -> 129.6 TB/month
```

Approximate AWS data-transfer-out cost for 2 hours/day, using common US/EU public
internet egress tiers and excluding tax:

```txt
100 kbps/camera -> about $2.8k/month
150 kbps/camera -> about $4.2k/month
250 kbps/camera -> about $6.5k/month
400 kbps/camera -> about $9.9k/month
```

Approximate LiveKit Cloud Scale cost for 2 hours/day:

```txt
100 kbps/camera -> about $8.6k/month
150 kbps/camera -> about $10.2k/month
250 kbps/camera -> about $13.5k/month
400 kbps/camera -> about $18.3k/month
```

Approximate AWS self-host production shape for this scenario:

```txt
4 x c7i.4xlarge or similar compute-optimized nodes
1 x Redis/ElastiCache small production node or small HA pair
1 x Network Load Balancer
EBS gp3 volumes
CloudWatch logs/metrics
```

For the 250 kbps/camera scenario running 2 hours/day, a practical AWS monthly
budget is roughly:

```txt
EC2 compute, always-on 4 nodes:     ~$2.3k-$2.8k
Data transfer out:                  ~$6.5k
NLB processed traffic:              ~$0.6k-$0.7k
Redis/EBS/IP/logs/monitoring:        ~$0.2k-$0.5k
Total:                              ~$9.5k-$10.5k/month
```

If the same load runs 24/7, the 250 kbps/camera case becomes much larger:

```txt
Downstream traffic:                 ~972 TB/month
AWS data transfer out:              ~$52k/month
NLB processed traffic:              ~$7.8k/month
Compute/supporting services:         ~$2.5k-$3.5k/month
Total:                              ~$62k-$65k/month
```

LiveKit Cloud Scale for the same 24/7 250 kbps case is estimated around
`$165k/month` before any enterprise discount.

## Cost Recommendation

For early product development, use LiveKit Cloud because it removes infrastructure
risk while rooms/auth/product UX are still changing.

For sustained high concurrency, self-hosting on AWS is likely cheaper, but only if
we control Ghost Cam bitrate tightly and are ready to operate media infrastructure.

The most important cost controls are:

- cap Ghost Cam bitrate explicitly;
- keep FPS around 8-12;
- keep camera resolution near 160-240 px;
- do not publish camera unless user enables Ghost Cam;
- use adaptive subscriptions so hidden/offscreen tracks are not downloaded;
- keep push-to-talk audio disabled unless a user is actually speaking;
- monitor per-room bitrate and total downstream GB from day one.
