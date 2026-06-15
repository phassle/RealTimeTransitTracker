// Pin the test timezone to UTC so time-formatting assertions are deterministic
// regardless of the developer's local timezone (CI runs UTC; locally EEST etc.
// would otherwise shift rendered times). Tests assume a UTC, sv-SE environment.
process.env.TZ = 'UTC';
