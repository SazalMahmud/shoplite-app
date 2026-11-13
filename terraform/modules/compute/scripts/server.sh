#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get install -y unzip curl && curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/a.zip && unzip -q /tmp/a.zip -d /tmp && /tmp/aws/install
TOKEN=$(openssl rand -hex 24)
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server --disable traefik --write-kubeconfig-mode 644" K3S_TOKEN="$TOKEN" sh -
aws ssm put-parameter --name "/${name}/k3s-token" --value "$TOKEN" --type SecureString --overwrite --region ap-southeast-1 || true
