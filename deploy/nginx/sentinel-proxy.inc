# Bloque común: proxy hacia Crow (scripts/iniciar.sh en 127.0.0.1:8090). Lo incluyen sentinel-https.conf.

# Los lotes etiquetados pueden pesar varios MB
client_max_body_size 50m;

gzip_proxied any;
gzip_types text/css text/javascript application/javascript application/json application/manifest+json image/svg+xml text/csv;

# Entrenar una candidata tarda unos segundos
proxy_read_timeout 120s;

location / {
    proxy_pass http://127.0.0.1:8090;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
