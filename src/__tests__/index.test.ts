describe('@codeshare/log', () => {
  let log

  beforeEach(async () => {
    process.env.APP_LOG_LEVEL = 'trace'
    process.env.APP_NAME = 'test'
    const module = await import('../index')
    log = module.default
  })

  it('should log', () => {
    log.info('yo')
  })
})
