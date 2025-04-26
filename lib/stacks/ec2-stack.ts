import * as fs from "fs";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export class PersonalEC2Stack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = new ec2.Vpc(this, "PesonalVpc", {
			maxAzs: 1,
			natGateways: 1
		});

		const securityGroup = new ec2.SecurityGroup(this, "PersonalSG", {
			vpc,
			description: "Allow HTTP, HTTPS and SSH",
			allowAllOutbound: true
		});
		securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), "SSH access");
		securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP access");
		securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS access");

		const dockerComposeContent = fs.readFileSync(path.join(__dirname, "../../resources/docker-compose.yml"), "utf8");

		const keyPair = ec2.KeyPair.fromKeyPairName(this, "PersonalKeyPair", "personal-key-pair");

		const instance = new ec2.Instance(this, "PersonalEC2Instance", {
			vpc,
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
			machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
			securityGroup,
			keyPair
		});
		instance.addUserData(
			// Update & install Docker
			"yum update -y",
			"yum install docker -y",
			"systemctl enable docker",
			"systemctl start docker",
			"usermod -aG docker ec2-user",

			// Install Docker Compose
			'curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose',
			"chmod +x /usr/local/bin/docker-compose",

			// Create directory for your apps
			"mkdir -p /var/docker-app",
			"chown ec2-user:ec2-user /var/docker-app",
			"cd /var/docker-app",
			`cat <<'EOF' > /var/docker-app/docker-compose.yml\n${dockerComposeContent}\nEOF`,

			// Pull Docker images and start containers
			"cd /var/docker-app",
			"docker-compose pull",
			"docker-compose up -d"
		);
		cdk.Tags.of(instance).add("Reserved", "true");

		new cdk.CfnOutput(this, "PersonalEC2InstancePublicIP", {
			value: instance.instancePublicIp
		});
	}
}
