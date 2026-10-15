import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  service: 'devflow-api';
}

@Injectable()
export class HealthService {
  getStatus(): HealthStatus {
    // Liveness only: no database or downstream readiness claim.
    return { status: 'ok', service: 'devflow-api' };
  }
}
