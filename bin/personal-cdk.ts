#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import { PersonalEC2Stack } from '../lib/stacks/ec2-stack';

const app = new cdk.App();

const ec2Stack = new PersonalEC2Stack(app, "PersonalEC2Stack", {});