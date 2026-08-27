// tests/loader-register.mjs — registers the ioredis alias loader before the test
// modules load. Invoked via `node --import ./tests/loader-register.mjs --test ...`.
import { register } from 'node:module';

register('./_loader.mjs', import.meta.url);
