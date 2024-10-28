import { Module } from '@nestjs/common';
import OAuth2Module from '../oauth2/oauth2.module';
import ServerInfoController from './server-info.controller';
import ConfigModule from '../config/config.module';

@Module({
  imports: [OAuth2Module, ConfigModule],
  controllers: [ServerInfoController],
})
export default class ServerInfoModule {}
