import express from 'express';
import { createLogger, Logger } from '@w3f/logger';
import { Config } from '@w3f/config';
import { InputConfig } from '../types';
import { SubscriberEraScanner } from '../subscriber/subscriberEraScanner.js';

const _createLogger = (cfg: InputConfig): Logger => {

    let logLevel = cfg.logLevel
    if (cfg.debug?.enabled) logLevel = 'debug'

    return createLogger(logLevel);
}

export const startAction = async (cmd): Promise<void> => {
    const cfg = new Config<InputConfig>().parse(cmd.config);

    const server = express();
    server.get('/healthcheck',
        async (req: express.Request, res: express.Response): Promise<void> => {
            res.status(200).send('OK!')
        })
    server.listen(cfg.healthCheckPort);

    const logger = _createLogger(cfg);
    const subscriber = new SubscriberEraScanner(cfg, logger);

    try {
        await subscriber.start();
    } catch (e) {
        logger.error(`During subscriber run: ${JSON.stringify(e)}`);
        process.exit(-1);
    }
}
