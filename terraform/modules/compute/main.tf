variable "name" { type = string }
variable "vpc_id" { type = string }
variable "vpc_cidr" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "instance_type" { type = string }
variable "worker_count" { type = number }

resource "aws_iam_role" "node" {
  name = "${var.name}-node-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "node" {
  name = "${var.name}-node-profile"
  role = aws_iam_role.node.name
}

resource "aws_security_group" "nodes" {
  name        = "${var.name}-nodes-sg"
  description = "K8s nodes: intra-VPC only, no public inbound"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name}-nodes-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "self" {
  security_group_id            = aws_security_group.nodes.id
  referenced_security_group_id = aws_security_group.nodes.id
  ip_protocol                  = "-1"
  description                  = "node to node"
}

resource "aws_vpc_security_group_ingress_rule" "from_vpc_http" {
  security_group_id = aws_security_group.nodes.id
  cidr_ipv4         = var.vpc_cidr
  from_port         = 30080
  to_port           = 30080
  ip_protocol       = "tcp"
  description       = "ALB to ingress NodePort"
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.nodes.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

resource "aws_instance" "control_plane" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = var.private_subnet_ids[0]
  vpc_security_group_ids = [aws_security_group.nodes.id]
  iam_instance_profile   = aws_iam_instance_profile.node.name
  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }
  metadata_options {
    http_tokens = "required"
    http_put_response_hop_limit = 2
  }
  user_data = templatefile("${path.module}/scripts/server.sh", { name = var.name })
  user_data_replace_on_change = true
  tags = { Name = "${var.name}-control-plane", role = "control-plane" }
}

resource "aws_instance" "worker" {
  count                  = var.worker_count
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = var.private_subnet_ids[count.index % length(var.private_subnet_ids)]
  vpc_security_group_ids = [aws_security_group.nodes.id]
  iam_instance_profile   = aws_iam_instance_profile.node.name
  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }
  metadata_options {
    http_tokens = "required"
    http_put_response_hop_limit = 2
  }
  user_data = templatefile("${path.module}/scripts/agent.sh", { name = var.name, server_ip = aws_instance.control_plane.private_ip })
  user_data_replace_on_change = true
  tags = { Name = "${var.name}-worker-${count.index + 1}", role = "worker" }
}

output "node_sg_id" { value = aws_security_group.nodes.id }
output "control_plane_id" { value = aws_instance.control_plane.id }
output "worker_ids" { value = aws_instance.worker[*].id }
output "control_plane_private_ip" { value = aws_instance.control_plane.private_ip }
output "worker_private_ips" { value = aws_instance.worker[*].private_ip }

resource "aws_iam_role_policy" "k3s_token" {
  name = "${var.name}-k3s-token"
  role = aws_iam_role.node.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:PutParameter", "ssm:GetParameter"]
      Resource = "arn:aws:ssm:*:*:parameter/${var.name}/k3s-token"
    }]
  })
}
