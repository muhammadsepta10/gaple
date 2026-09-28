import { buatServer } from './server';

const port = Number(process.env.PORT ?? 2567);
await buatServer().listen(port);
console.log(`gaple server: port ${port}`);
