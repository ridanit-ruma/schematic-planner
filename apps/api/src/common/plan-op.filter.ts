import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { PlanOpError } from '@schematic/schema';
import type { Response } from 'express';

/**
 * A rejected batch is the caller's mistake, not the server's. Reported as 400
 * with the reason, because the caller is usually an agent that can correct it —
 * a bare 500 tells it nothing and it retries the same broken batch.
 */
@Catch(PlanOpError)
export class PlanOpExceptionFilter implements ExceptionFilter {
  catch(exception: PlanOpError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(400)
      .json({ statusCode: 400, error: 'Bad Request', message: exception.message });
  }
}
