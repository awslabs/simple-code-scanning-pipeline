#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
// import { RemovalPolicy } from 'aws-cdk-lib';
import { SimpleCodeScanningPipelineStack } from '../lib/scsp-pipeline-stack';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new cdk.App();

// Try to get context of good files/bad files, if not found just use the standard "blank" .zip
// This is provided as a CDK command-line context (--context starting-files=good) instead of parameter since it should only be exposed to GP devs
// Example: cdk deploy --require-approval never --context starting-files=good --path-metadata false --version-reporting false
// Warning! Make sure to run a context-free `cdk synth --path-metadata false --version-reporting false` in order to generate the correct template for non-dev users!!
const startingFiles = app.node.tryGetContext('starting-files');
const starterZip =
    startingFiles == 'good'
        ? 'initial_scsp_repo_good.zip'
        : startingFiles == 'bad'
        ? 'initial_scsp_repo_bad.zip'
        : 'initial_scsp_repo.zip';

new SimpleCodeScanningPipelineStack(app, 'scsp-pipeline-stack', {
    synthesizer: new cdk.DefaultStackSynthesizer({
        generateBootstrapVersionRule: false
    }),
    starterZip: starterZip,
    // Use this setting to avoid exposing a CfnParameter for this setting
    // removalPolicy: RemovalPolicy.DESTROY
});

if (app.node.tryGetContext('cdkNagScanning') === 'on') {
    cdk.Aspects.of(app).add(new AwsSolutionsChecks());
}

app.synth();
