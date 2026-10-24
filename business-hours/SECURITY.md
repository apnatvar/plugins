# Security

Report suspected vulnerabilities privately to contact@brownsmithdynamics.com with
package version, runtime/tzdata versions and a minimal reproduction without customer
data. Allow investigation before public disclosure. The initial 0.1.x line is the
only planned supported line; publication is still pending. No response-time SLA is promised.

## Threat model and review findings

Schedules, instants and options may be untrusted JSON. The engine rejects unknown
keys, unsupported object prototypes, accessors, unsafe property names, malformed
ISO dates/times, invalid time zones and excessive schedule sizes. It uses Map/Set
rather than user-keyed prototype dictionaries for internal date indexes. It never
merges supplied objects into prototypes or executes schedule strings.

Calendar iteration has a hard maximum of 3660 days plus fixed boundary padding,
with a default 366 day limit. Arrays have size caps before value traversal. Interval
union/conflict calculation is bounded and sorted; no open-ended next-opening scan
or retry loop is used. Provider results are cached only within a calculation.

No filesystem, network, telemetry, subprocess, storage or timer operations exist
in runtime source. Build/install/validation tooling does use filesystem/network APIs;
it is excluded from the package. The only runtime dependencies are the Temporal
polyfill and JSBI. See PUBLISHING.md and the validation record for license/audit results.

## Trust boundaries and limitations

JavaScript proxies can execute traps during inspection; objects supplied by executable
code are not a sandbox boundary. Use parsed JSON and trusted callback functions.
The synchronous holiday provider is application code: it must terminate promptly,
return a boolean and avoid I/O. JavaScript cannot safely interrupt an infinite callback;
applications needing isolation should run untrusted code outside this library.

Queries are deterministic with identical provider answers and runtime timezone data.
Keep ICU/tzdata current. Future legal time-zone changes and incomplete supplied holiday
lists can alter business decisions; the library cannot validate external policy accuracy.
Configuration is copied at construction; callers must construct a new engine to change
hours. Do not attach personal customer data to schedules or public bug reports.
