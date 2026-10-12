# The scheduler container (docker-compose.prod.yml): curl and the time zone
# data baked in, so it starts without network access and runs as a plain user
# on a read-only filesystem.
FROM alpine:3.24
RUN apk add --no-cache curl tzdata \
    && adduser -S -D -H -u 1001 scheduler
COPY deploy/scheduler.sh /scheduler.sh
ENV TZ=Asia/Kolkata
USER scheduler
ENTRYPOINT ["/bin/sh", "/scheduler.sh"]
