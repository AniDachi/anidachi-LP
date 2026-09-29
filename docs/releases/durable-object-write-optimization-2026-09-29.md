# Оптимизация Durable Objects: реализация и приемка

29 сентября 2026. Реализация `33ecea63` → `79f86963` → `ef4537f6` → `5bed2e55`,
от staging `1f4ad13f`. [План](../superpowers/plans/2026-09-29-durable-object-write-optimization.md)
и [решение](../superpowers/specs/2026-09-29-durable-object-write-optimization-design.md).
Оптимизация поставлена в staging через [PR #381](https://github.com/AniDachi/anidachi-LP/pull/381),
merge `1d50432cc215f05ab3123891bac7fd3b560e907d`. Этот отчет фиксирует локальное
доказательство, фактическую поставку и откат. Ручная приемка владельца и реальный
суточный расход пока не подтверждены. Эта запись относится к runtime-поставке;
последующие изменения документации не меняют указанную версию Worker.

## Изменения

- Неизменившиеся meter, policy и фактический alarm больше не записываются повторно.
- Непрерывный просмотр хранит исходный `activeSince`. Перед внешним запросом
  накопленное время материализуется, сохраняется и проходит `storage.sync()`.
- Квота и предупреждение используют абсолютное время с точностью до миллисекунд.
- Snapshot сравнивается с долговечным содержимым без служебного `updatedAt`;
  изменение sequence по-прежнему сохраняется. Denials обновляются разницей множеств.
  Обе записи остаются одной SQLite-транзакцией, с проверенным rollback/retry.
- После hibernation сначала восстанавливается исходный alarm. Просроченный лимит
  предыдущего дня проверяется до переноса meter в новые сутки; потерянный alarm
  восстанавливается из уже сохраненных обязанностей.

Протокол, частота доставки событий, схемы хранения, расширение, коммерческие
правила, Stripe, Supabase migrations и секреты не менялись.

## Измерения

Один сценарий: 20 принятых HOST_STATE каждые 1500 мс тестового времени, после
JOIN и первоначального сохранения source. Настоящие WebSocket, signed v3 tokens,
Workers runtime и SQLite. Считаются реальные `SqlStorageCursor.rowsWritten`;
KV/alarm вызовы учитываются отдельно. Проверяются доставка и рост sequence.

| Сценарий | SQLite до | SQLite после | Изменение | KV puts до → после | Alarm sets до → после |
| --- | ---: | ---: | ---: | ---: | ---: |
| Free один | 100 | 20 | −80% | 20 → 0 | 20 → 0 |
| Free + гость | 80 | 20 | −75% | 20 → 0 | 20 → 0 |
| Plus + гость | 100 | 20 | −80% | 20 → 0 | 20 → 0 |
| Pro + гость | 100 | 20 | −80% | 20 → 0 | 20 → 0 |

Все 20 необходимых snapshot-записей остаются. Повторный snapshot с двумя
неизменившимися denials: 7 записанных строк → 0. Эти счетчики нельзя складывать
как точную сумму биллинга. Замер не включает JOIN/LEAVE, refresh, source retries
и реальное соотношение пользовательских событий. Оценка 30–50 тысяч записей
в сутки из проекта решения остается прогнозом, а не измеренным результатом.

## Автоматические проверки

- API check и 252 unit-теста; 96 Workers runtime-тестов.
- Protocol check и 203 теста; room signaling harness — 39/39.
- Реальный WebRTC: legacy — 26/26, включая reload, потерю сети, offer/answer,
  повторный push-to-talk; v3 четыре участника — все проверки успешны, 12/12
  видеопотоков, p95 первого кадра 1559.5 мс, revoke/regrant и прием медиа сохранены.
  Локальные ICE host/host; TURN и физические устройства этим не подтверждены.
- `pnpm dev:check`: api/rooms/docs. Независимое ревью `1f4ad13f..5bed2e55`
  не выявило runtime-дефектов; замечание об устаревшем статусе закрыто обновлением
  документации в плановом этапе O5.
- RED → GREEN: лишние записи; стабильный interval anchor; snapshot no-op;
  rollback SQLite и одинаковый retry; hibernation через UTC с присутствующим
  и отсутствующим alarm. Старые terminal/cutover/ACK тесты сохранены.

## Контроль поставки и откат

Перед поставкой 29 сентября: staging Worker на 100% использует
`78e5de69-f2dc-42f6-b5d7-e44cc4b24f82`, последний API workflow для `50a054b3`
[успешен](https://github.com/AniDachi/anidachi-LP/actions/runs/36481260183).
Read-only Supabase staging: activation_at NULL, revision 1, trials_enabled false,
scheduler disabled, operation/target/trial rows — 0. Promotion #376 открыт,
auto-merge NULL. После staging deployment readback подтвердил те же значения.

Поставка завершена 29 сентября 2026 года:

- PR #381 слит в staging в 02:45:09 UTC, точный merge SHA указан выше.
- PR [CI](https://github.com/AniDachi/anidachi-LP/actions/runs/36513485683),
  [room signaling](https://github.com/AniDachi/anidachi-LP/actions/runs/36513485720)
  и [P2P](https://github.com/AniDachi/anidachi-LP/actions/runs/36513485666) прошли.
  CodeRabbit пропустил ревью для staging; независимое ревью кода проведено отдельно.
- [Deploy API](https://github.com/AniDachi/anidachi-LP/actions/runs/36514058395)
  успешен. Версия `f7942d07-cb7a-473e-9484-c26768ea04c2` получает 100% staging
  traffic с 02:46:23 UTC. Wrangler readback совпадает с version ID в workflow.
- `pnpm smoke:worker:staging` прошел на новом Worker. Post-merge
  [rooms](https://github.com/AniDachi/anidachi-LP/actions/runs/36514068494)
  и [P2P](https://github.com/AniDachi/anidachi-LP/actions/runs/36514068601) прошли.
- Vercel `dpl_BiPz6qKQbLcj3Zho2yRCm2mdR4pq` — READY для merge `1d50432c`,
  alias `staging.anidachi.app`. Post-merge
  [CI](https://github.com/AniDachi/anidachi-LP/actions/runs/36514058487) и
  [staging Web smoke](https://github.com/AniDachi/anidachi-LP/actions/runs/36514275763)
  прошли. Исходники сайта не менялись.
- Supabase staging после поставки: T NULL, revision 1, trials_enabled false,
  scheduler disabled, operation/target/trial rows — 0. Техническая поставка
  не включает новую коммерческую модель и не заменяет ручную приемку.

Main/production и Chrome Store не изменялись. O6 завершен; O7 (владелец) и O8
(продолжение trial-проверок после приемки оптимизации) остаются открытыми.

Откат Worker: вернуть указанную предыдущую staging-версию через штатный rollback,
проверить health/smoke и восстановление комнаты; затем revert PR в staging.
Storage schema и migration tags не менялись, прежний Worker читает те же данные.
Откат возвращает также прежний расход и прежнее поведение UTC recovery.
Никакой очистки DO/Supabase, смены ключей или включения T не требуется.

## Ручной сценарий владельца после поставки

Использовать `staging.anidachi.app` и отдельные тестовые профили. Старый staging
ZIP `cb7f7a86` и новый кандидат `59d6e80e` уже сохранены: [артефакты и SHA](paid-hosting-trial/minimum-website-2026-09-29.md#две-сборки-расширения).
Оптимизация не требует нового ZIP; нужные папки не перезаписывать между проверками.

1. На старом клиенте создать Free-комнату. В одиночку счетчик не расходуется;
   после входа гостя — расходуется; после выхода гостя — приостанавливается.
2. Проверить play/pause, перемотку, смену видео, короткий обрыв сети, reload
   гостя и хоста, повторный вход. Комната и синхронизация восстанавливаются.
3. В Plus/Pro проверить камеры, микрофоны, push-to-talk и revoke/regrant места.
   Повторить с новым кандидатом и со смешанной парой старый/новый клиент.
4. Проверить предупреждение Free о пяти минутах, исчерпание лимита и закрытие;
   до отдельной активации trial действуют прежние правила Free.
5. Сообщить результат и точное время/room ID при сбое. После сопоставимой
   нагрузки сравнить Cloudflare staging rowsWritten/errors/duration за равные
   окна, отдельно от production, с учетом числа событий и длительности комнат.

До ручной приемки не возобновлять trial-активацию. После нее остаются отдельные
Sandbox/P11/старый Store-клиент и согласование main/Store/T.
