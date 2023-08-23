import { Stack, StackProps } from 'aws-cdk-lib';
import {
    Effect,
    Policy,
    PolicyStatement,
    Role,
    ServicePrincipal,
    User
} from 'aws-cdk-lib/aws-iam';
import { Bucket, BucketPolicy } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

export class CdkNagTestStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Example 1 - An IAM user with * to GetObject
        const getAnyObjectPolicy = new Policy(this, 'testPolicy2', {
            statements: [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['s3:GetObject'],
                    resources: ['*']
                })
            ]
        });
        // const myRole = new Role(this, 'test', {
        //   assumedBy: new ServicePrincipal('iam.amazonaws.com'),
        // })
        // myRole.withoutPolicyUpdates

        const superUser = new User(this, 'superUser');
        superUser.attachInlinePolicy(getAnyObjectPolicy);

        // Suppress by object
        /* Remove suppression for known-bad testing
    NagSuppressions.addResourceSuppressions(
      getAnyObjectPolicy, // superUser does not seem to show this as a sub-property
      [
        {
          id: "AwsSolutions-IAM5", 
          reason: "SuperUsers are too cool for school",
          //appliesTo: ["Resource::*"]
        }
      ],
       // Applies the exclusion to child resources of this resource
    )
    */
        // Suppress by path
        // NagSuppressions.addResourceSuppressionsByPath(
        //   this,
        //   "/CdkNagTestStack/testPolicy2/Resource", // "/LeadSpyBlackBook-0/-Api/Services/-blackBookService/BlackBooklambdaRole/DefaultPolicy/Resource"
        //   [
        //     {
        //       id: "AwsSolutions-IAM5",
        //       reason: "SuperUsers are too cool for school",
        //       appliesTo: ["Resource::*"]
        //     }
        //   ],
        //   true
        // )
        // Example 2 - A Bucket policy that allows * access.
        // const badBucket = new Bucket(this, 'badBucket')
        // const bucketPolicy = new BucketPolicy(this, 'buckPol', {
        //   bucket: badBucket
        // })
        // bucketPolicy.document.addStatements(
        //   new PolicyStatement({
        //     effect: Effect.ALLOW,
        //     actions: ["s3:GetObject"],
        //     resources: ["*"],
        //     principals: [new ServicePrincipal('cloudformation.amazonaws.com')],
        //   })
        // )
    }
}
