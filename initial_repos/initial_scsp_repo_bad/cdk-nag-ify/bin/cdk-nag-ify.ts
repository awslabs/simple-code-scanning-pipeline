#!/usr/bin/env node
import { CdkNagFrameworkStack } from '../lib/cdk-nag-ify-stack';
import { App, Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new App();
new CdkNagFrameworkStack(app, 'cdkNag-ified-Stack', {});
if (app.node.tryGetContext('cdkNagScanning') == 'on') {
    Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
}
// app.synth()
