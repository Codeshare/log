# log
Codeshare Application Logger

# Usage
```js
import log from '@codeshare/log'

log.fatal('message', {/*...*/})
log.error('message', {/*...*/})
log.warn('message', {/*...*/})
log.info('message', {/*...*/})
log.debug('message', {/*...*/})
log.trace('message', {/*...*/})
```

```js
log.logRequest({/*...*/})
```

```js
await log.onFinish()
```
