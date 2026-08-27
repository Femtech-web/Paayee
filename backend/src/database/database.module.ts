import { Global, Module } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

import { AppConfig } from '../config';

export const SUPABASE_ADMIN = Symbol('SUPABASE_ADMIN');

@Global()
@Module({
  providers: [
    AppConfig,
    {
      provide: SUPABASE_ADMIN,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    },
  ],
  exports: [AppConfig, SUPABASE_ADMIN],
})
export class DatabaseModule {}
