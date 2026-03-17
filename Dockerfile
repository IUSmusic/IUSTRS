FROM node:22-alpine AS build
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/audio-engine/package.json packages/audio-engine/package.json
COPY packages/midi-engine/package.json packages/midi-engine/package.json
COPY packages/transcription-engine/package.json packages/transcription-engine/package.json
COPY packages/music-theory/package.json packages/music-theory/package.json
COPY packages/score-renderer/package.json packages/score-renderer/package.json
COPY packages/exporters/package.json packages/exporters/package.json

RUN npm install

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
