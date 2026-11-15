#!/usr/bin/env bash
set -x
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -m 0755 kubectl /usr/local/bin/kubectl && rm kubectl
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

k3d cluster create shoplite --servers 1 --agents 2 \
  --k3s-arg "--disable=traefik@server:0" -p "8081:80@loadbalancer"

helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer

cd ~/code/shoplite-app
docker compose build
for s in web catalog-api order-worker; do
  docker tag shoplite-app-$s:latest local/$s:dev
  k3d image import local/$s:dev -c shoplite
done

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install kps prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  --set grafana.adminPassword=admin123 \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false

kubectl create namespace argocd
kubectl apply -n argocd --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

for ns in shoplite shoplite-prod; do
  kubectl create namespace $ns
  kubectl -n $ns create secret generic shoplite-db --from-literal=DB_PASSWORD='ChangeMe123'
done
echo BOOTSTRAP_DONE
