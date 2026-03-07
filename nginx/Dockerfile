FROM nginx:alpine
RUN apk add --no-cache wget
COPY wait-for-upstream.sh /wait-for-upstream.sh
RUN chmod +x /wait-for-upstream.sh
ENTRYPOINT ["/wait-for-upstream.sh"]
