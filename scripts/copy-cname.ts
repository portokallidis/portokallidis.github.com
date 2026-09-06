import { copyFileSync } from 'node:fs';

copyFileSync('CNAME', 'dist/CNAME');
