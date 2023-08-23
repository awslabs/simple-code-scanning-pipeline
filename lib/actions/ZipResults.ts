import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Construct } from 'constructs';
import { ActionDefaultSettings } from './ActionDefaultSettings';
import {
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal
} from 'aws-cdk-lib/aws-iam';
import { Duration, Stack } from 'aws-cdk-lib';
import {
    Artifacts,
    BuildSpec,
    ComputeType,
    LinuxBuildImage,
    Project
} from 'aws-cdk-lib/aws-codebuild';
import { ZipProps } from '../StandardizedCodeBuildProjectProps';

export class ZipAction extends CodeBuildAction {
    constructor(scope: Construct, id: string, props: ZipProps) {
        super(
            Object.assign({}, ActionDefaultSettings, {
                // runOrder: 1, // Cannot use runOrder to make this run after other steps, as failures will block later runOrder groups
                actionName: `${id}-${props.pipelineName}`,
                project: new Project(scope, 'zipProject', {
                    projectName: `${id}-${props.pipelineName}`,
                    description:
                        'Project that zips the contents of the build folder into a summary zip.',
                    buildSpec: BuildSpec.fromObjectToYaml({
                        version: 0.2,
                        phases: {
                            install: {
                                commands: [
                                    `MAX_TRIES=8;`,
                                    `sleep 60;`, // The other tools will take at least 1 minute
                                    // repeatedly check the contents of the log output bucket until the number of files matches the number of actions in the scan stage.
                                    [
                                        `for (( i=1; i<=$MAX_TRIES; i++ )) ; do`,
                                        `    sleep 30;`,
                                        // Download all the log results
                                        `    LOG_COUNT=$(aws s3 ls s3://${props.artifactBucket.bucketName}/scan_results/\${START_TIME}-execution-$PIPELINE_RUN_ID/ | grep .log | wc -l);`,
                                        `    echo LOG_COUNT is $LOG_COUNT`,
                                        `    if [[ $LOG_COUNT == ${props.scanActionCount} ]]; then`,
                                        `        break;`,
                                        `    fi`,
                                        `done`
                                    ].join('\n'),
                                    [
                                        `if [[ $LOG_COUNT != ${props.scanActionCount} ]]; then`,
                                        `    echo "ERROR - Not all tools successfully uploaded scan results. Proceeding with scans that did complete."`,
                                        `fi`
                                    ].join('\n')
                                ]
                            },
                            build: {
                                commands: [
                                    `aws s3 sync s3://${props.artifactBucket.bucketName}/scan_results/\${START_TIME}-execution-$PIPELINE_RUN_ID . --include "*.log" --exclude "*/*";`,
                                    // Zip all the log files into a tarball
                                    `find . -name '*.log' -print0 | tar -czf ${props.repoName}-${props.branchName}.tar.gz --exclude='./*/*' --exclude='./*/' --files-from -` // need dash (-) after --files-from to indicate stdin, per https://stackoverflow.com/questions/5747755/tar-with-include-pattern
                                ]
                            },
                            post_build: {
                                commands: [
                                    // Upload the tarball
                                    `aws s3api put-object --bucket ${props.artifactBucket.bucketName} --key scan_results/\${START_TIME}-execution-$PIPELINE_RUN_ID/${props.repoName}-${props.branchName}.tar.gz --body ${props.repoName}-${props.branchName}.tar.gz > /dev/null`,
                                    // Create a plain text summary of what passed and failed and include that in the S3 bucket as well
                                    `SUMMARY=${props.repoName}-${props.branchName}-summary.txt`,
                                    `BUCKET_KEY=scan_results/\${START_TIME}-execution-$PIPELINE_RUN_ID/$SUMMARY`,
                                    `aws codepipeline list-action-executions --pipeline-name ${props.pipelineName} --filter pipelineExecutionId=$PIPELINE_RUN_ID | jq -r '.actionExecutionDetails[] | select(.stageName=="validate") | select(.actionName!="${id}") | .actionName+": "+.status' | tee -a $SUMMARY`,
                                    `aws s3api put-object --bucket ${props.artifactBucket.bucketName} --key $BUCKET_KEY --body $SUMMARY > /dev/null`
                                ]
                            }
                        }
                    }),
                    environment: {
                        computeType: ComputeType.SMALL,
                        buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
                        privileged: false
                    },
                    timeout: Duration.minutes(
                        props.TIMEOUT_MINUTES ? props.TIMEOUT_MINUTES + 2 : 7
                    ),
                    queuedTimeout: Duration.minutes(10),
                    // At this point, this artifacts section is mainly just here to grant the role permissions to PutObjects to S3 in the post_build phase
                    artifacts: Artifacts.s3({
                        bucket: props.artifactBucket,
                        packageZip: false
                    }),
                    role: new Role(scope, 'scsp-summary-upload-role', {
                        assumedBy: new ServicePrincipal(
                            'codebuild.amazonaws.com'
                        ),
                        inlinePolicies: {
                            uploadPolicy: new PolicyDocument({
                                statements: [
                                    new PolicyStatement({
                                        actions: [
                                            's3:Abort*',
                                            's3:DeleteObject*',
                                            's3:GetBucket*',
                                            's3:GetObject*',
                                            's3:List*',
                                            's3:PutObject',
                                            's3:PutObjectLegalHold',
                                            's3:PutObjectRetention',
                                            's3:PutObjectTagging',
                                            's3:PutObjectVersionTagging'
                                        ],
                                        resources: [
                                            props.artifactBucket.bucketArn,
                                            `${props.artifactBucket.bucketArn}/*`
                                        ]
                                    }),
                                    new PolicyStatement({
                                        actions: [
                                            'logs:CreateLogGroup',
                                            'logs:CreateLogStream',
                                            'logs:PutLogEvents'
                                        ],
                                        resources: [
                                            `arn:aws:logs:${
                                                Stack.of(scope).region
                                            }:${
                                                Stack.of(scope).account
                                            }:log-group:/aws/codebuild/${id}:*`,
                                            `arn:aws:logs:${
                                                Stack.of(scope).region
                                            }:${
                                                Stack.of(scope).account
                                            }:log-group:/aws/codebuild/${id}`
                                        ]
                                    }),
                                    new PolicyStatement({
                                        actions: [
                                            'codebuild:BatchPutCodeCoverages',
                                            'codebuild:BatchPutTestCases',
                                            'codebuild:CreateReport',
                                            'codebuild:CreateReportGroup',
                                            'codebuild:UpdateReport'
                                        ],
                                        resources: [
                                            `arn:aws:codebuild:${
                                                Stack.of(scope).region
                                            }:${
                                                Stack.of(scope).account
                                            }:report-group/${id}-*`
                                        ]
                                    }),
                                    new PolicyStatement({
                                        actions: [
                                            'codepipeline:ListActionExecutions'
                                        ],
                                        resources: [
                                            `arn:aws:codepipeline:${
                                                Stack.of(scope).region
                                            }:${Stack.of(scope).account}:${
                                                props.pipelineName
                                            }`
                                        ]
                                    })
                                ]
                            })
                        }
                    })
                })
            })
        );
    }
}
