import {
    Artifacts,
    BuildSpec,
    ComputeType,
    LinuxBuildImage,
    Project
} from 'aws-cdk-lib/aws-codebuild';
import { CodeBuildProjectProps } from './CodeBuildProjectProps';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { LogGroup } from 'aws-cdk-lib/aws-logs';

export class StandardizedCodeBuildProject extends Project {
    constructor(scope: Construct, id: string, props: CodeBuildProjectProps) {
        const postBuildPrependSteps =
            typeof props.prePostBuildCommands == 'undefined'
                ? []
                : props.prePostBuildCommands;
        super(scope, id, {
            projectName: `${props.projectName}-${props.pipelineName}`,
            description: props.description,
            buildSpec: BuildSpec.fromObjectToYaml({
                version: 0.2,
                phases: {
                    // Explicitly set an EXITCODE variable used to track command execution failures, then run the remaining commands normally
                    // ProTip: Use bitwise OR to update the EXITCODE based on the exit status of each tool execution (( EXITCODE |= $? ))
                    install: {
                        commands: [`EXITCODE=0`].concat(props.installCommands)
                    },
                    build: { commands: props.buildCommands }, // Possibly useful command: `set -o pipefail` which will return a non-zero status if any command in the pipe fails
                    post_build: {
                        commands: postBuildPrependSteps.concat([
                            // Upload the files to the Artifact bucket in a subkey specific to this pipeline execution
                            `aws s3api put-object --bucket ${props.artifactBucket.bucketName} --key scan_results/\${START_TIME}-execution-$PIPELINE_RUN_ID/${props.projectName}.log --body ${props.projectName}.log > /dev/null`,
                            `echo "Log uploaded to ${props.artifactBucket.bucketName}/scan_results/\${START_TIME}-execution-$PIPELINE_RUN_ID/${props.projectName}.log"`,
                            [
                                `if [[ $EXITCODE -eq 0 ]]; then`,
                                `    echo "${props.projectName} completed without finding security errors."`,
                                `else`,
                                `    echo "${props.projectName} failed due to security errors in repo contents."`,
                                `fi`
                            ].join('\n'),
                            `exit $EXITCODE`
                        ])
                    }
                }
            }),
            environment: {
                computeType: ComputeType.SMALL,
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_4,
                privileged: false
            },
            timeout: Duration.minutes(props.TIMEOUT_MINUTES || 5),
            queuedTimeout: Duration.minutes(15),
            logging: {
                cloudWatch: {
                    enabled: true,
                    logGroup: new LogGroup(scope, `${props.projectName}Logs`, {
                        logGroupName: `/${props.pipelineName}/${props.projectName}`,
                        removalPolicy: props.removalPolicy
                    })
                }
            },
            // At this point, this artifacts section is mainly just here to grant the role permissions to PutObjects to S3 in the post_build phase
            artifacts: Artifacts.s3({
                bucket: props.artifactBucket,
                packageZip: false
            })
        });
    }
}
