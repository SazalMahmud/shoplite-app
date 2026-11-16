# ShopLite Architecture

## Target architecture (AWS, defined in Terraform)

    Internet
       |
    [ALB]  (public subnets, 2 AZs)
       |  NodePort 30080
    [ingress-nginx]  (k3s, private subnets)
       |-- /     -> web (nginx)
       |-- /api  -> catalog-api --> PostgreSQL (StatefulSet + PVC)
                        |
                        +--> Redis list orders:pending
                                   |
                           order-worker --> PostgreSQL (order status)

- VPC 10.0.0.0/16: 2 public + 2 private subnets, IGW, 1 NAT gateway
- Nodes: 1 control-plane + 2 workers (t3.medium, private subnets)
- ECR: web, catalog-api, order-worker
- Terraform state: S3 bucket + DynamoDB lock table

## Delivery flow

    git push (shoplite-app)
      -> GitHub Actions: lint, test, build, Trivy scan, push to ECR (OIDC)
      -> bump imageTag in shoplite-gitops
      -> ArgoCD sync (dev: auto + self-heal, prod: manual)
      -> cluster

## Observability

kube-prometheus-stack (Prometheus, Alertmanager, Grafana), ServiceMonitors
for catalog-api and order-worker, 5 PrometheusRules with runbooks in
monitoring/runbooks/.

## What actually ran in the demo

The Helm chart, ArgoCD (dev/prod) and the chaos exercise ran on a local
3-node k3d cluster inside the Poridhi lab, because the lab IAM user could
not create IAM roles or use SSM for the EC2 cluster.
