import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS caso o front-end precise acessar o back-end
  app.enableCors();

  // Adicionar um log para saber em qual porta o servidor está rodando
  const PORT = process.env.PORT || 3333;
  await app.listen(PORT);
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
}

bootstrap();
