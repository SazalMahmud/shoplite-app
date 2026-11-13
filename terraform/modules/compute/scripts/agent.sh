#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get install -y unzip curl && curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/a.zip && unzip -q /tmp/a.zip -d /tmp && /tmp/aws/install
for i in $(seq 1 60); do
  TOKEN=$(aws ssm get-parameter --name "/${name}/k3s-token" --with-decryption --query Parameter.Value --output text --region ap-southeast-1 2>/dev/null) && break
  sleep 10
done
curl -sfL https://get.k3s.io | K3S_URL="https://${server_ip}:6443" K3S_TOKEN="$TOKEN" sh -
