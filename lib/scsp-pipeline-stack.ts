import { Construct } from 'constructs';
import {
    CfnParameter,
    Duration,
    RemovalPolicy,
    Stack,
    StackProps,
    Fn,
    CfnCondition
} from 'aws-cdk-lib';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import {
    BlockPublicAccess,
    Bucket,
    BucketEncryption
} from 'aws-cdk-lib/aws-s3';
import { CodeCommitSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { CfnRule as CfnTemplateRule } from 'aws-cdk-lib';
import { ConditionalPipelineRepo } from './ConditionalPipelineRepo';
import { SimpleCodeScanningPipelineResourceProps } from './SimpleCodeScanningPipelineResourceProps';
import { ConditionalSimpleCodeScanningPipelineResources } from './ConditionalSimpleCodeScanningPipelineResources';
import { BanditAction } from './actions/Bandit';
import { ZipAction } from './actions/ZipResults';
import { FlakeAction } from './actions/Flake8';
import { CfnNagAction } from './actions/CfnNag';
import { CheckovAction } from './actions/Checkov';
import { RdkAction } from './actions/RdkUnitTests';
import { GitLeaksAction } from './actions/GitLeaks';
import { SqlFluffAction } from './actions/SqlFluff';
import { TrivyAction } from './actions/Trivy';
import { SemgrepAction } from './actions/Semgrep';
import { CdkNagForCFTsAction } from './actions/CdkNagForCFTs';
import { CdkNagForCdkAction } from './actions/CdkNagForCDK';
import { JsHintAction } from './actions/JsHint';
import { TfsecAction } from './actions/Tfsec';
import {
    CdkNagProps,
    CfnNagProps,
    CheckovProps,
    JsHintProps,
    RdkProps,
    SemgrepProps,
    SqlFluffProps,
    StandardizedCodeBuildProjectProps,
    TfsecProps,
    ZipProps
} from './StandardizedCodeBuildProjectProps';
// import { Stage } from 'aws-cdk-lib/aws-codepipeline/lib/private/stage'; // Eventually, this will be an exportable stage that can be reused in larger pipelines

const YQ_VERSION = 'v4.33.3';
const TIMEOUT_MINUTES = 5;
interface SimpleCodeScanningPipelineStackProps extends StackProps {
    removalPolicy?: RemovalPolicy;
    starterZip: string;
}

export class SimpleCodeScanningPipelineResources extends Construct {
    constructor(
        scope: Construct,
        id: string,
        props: SimpleCodeScanningPipelineResourceProps
    ) {
        super(scope, id);

        const pipelineName = Fn.conditionIf(
            props.createNewRepo.logicalId,
            `${props.NewRepoName}-${props.branchName}`,
            `scsp-${props.existingRepoARN.split(':')[-1]}-${props.branchName}`
        ).toString();
        const repoName = `${props.NewRepoName}-${Stack.of(this).account}`; // Append the account ID

        const CodePipelineRole = new Role(this, 'CodePipelineRole', {
            assumedBy: new ServicePrincipal('codepipeline.amazonaws.com'),
            maxSessionDuration: Duration.seconds(3600),
            description: ''
        });

        const repoObject = new ConditionalPipelineRepo(this, 'repoObject', {
            initialRepoContentsBucketName: 'proservetools',
            repoStarter: `res/${props.starterZip}`,
            existingRepoArn: props.existingRepoARN,
            newRepoName: repoName,
            removalPolicy: props.removalPolicy
        });
        const repositoryArn = Fn.conditionIf(
            repoObject.newRepoExists.logicalId,
            repoObject.newRepoArn,
            props.existingRepoARN
        ).toString();

        const artifactBucket = new Bucket(this, 'artifactBucket', {
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            versioned: true
            // comment this out for now - these options conflict with creating
            // this resource with a condition statement added to the resource.
            // removalPolicy: props.removalPolicy,
            // autoDeleteObjects: (props.removalPolicy == RemovalPolicy.DESTROY)
        });

        const ActionProps: StandardizedCodeBuildProjectProps = {
            pipelineName: pipelineName,
            removalPolicy: props.removalPolicy,
            artifactBucket: artifactBucket
        };
        const CdkNagProps: CdkNagProps = {
            ...ActionProps,
            YQ_VERSION: YQ_VERSION
        };
        const CfnNagProps: CfnNagProps = {
            ...ActionProps,
            cfnTemplatesPath: props.cfnTemplatesPath
        };
        const CheckovProps: CheckovProps = {
            ...ActionProps,
            checkovSeverityTrigger: props.checkovSeverityTrigger,
            terraformCodePath: props.terraformCodePath
        };
        const JsHintProps: JsHintProps = {
            ...ActionProps,
            JSHintExclude: props.JSHintExclude,
            JSHintConfigFile: props.JSHintConfigFile,
            JSHintConfigFlag: props.JSHintConfigFlag
        };
        const RdkUnitTestProps: RdkProps = {
            ...ActionProps,
            configRulesPath: props.configRulesPath
        };
        const SemgrepProps: SemgrepProps = {
            ...ActionProps,
            SemgrepSeverity: props.SemgrepSeverity,
            SemgrepConfig: props.SemgrepConfig
        };
        const SqlFluffProps: SqlFluffProps = {
            ...ActionProps,
            sqlDialect: props.sqlDialect
        };
        const TfsecProps: TfsecProps = {
            ...ActionProps,
            tfsecSeverity: props.tfsecSeverity,
            tfsecExclude: props.tfsecExclude
        };

        const scanActions = [
            new BanditAction(this, 'Bandit', ActionProps),
            new CdkNagForCdkAction(this, 'CdkNagForCdk', CdkNagProps),
            new CdkNagForCFTsAction(this, 'CdkNagForCfts', CdkNagProps),
            new CfnNagAction(this, 'CfnNag', CfnNagProps),
            new CheckovAction(this, 'Checkov', CheckovProps),
            new FlakeAction(this, 'Flake8', ActionProps),
            new GitLeaksAction(this, 'GitLeaks', ActionProps),
            new JsHintAction(this, 'JSHint', JsHintProps),
            new RdkAction(this, 'RdkUnitTest', RdkUnitTestProps),
            new SemgrepAction(this, 'Semgrep', SemgrepProps),
            // new ShellCheckConstruct(this, "ShellCheck", ActionProps).ShellCheckAction, // Commenting out since Shellcheck licensing doesn't meet AWS Legal approval
            new SqlFluffAction(this, 'SqlFluff', SqlFluffProps),
            new TfsecAction(this, 'Tfsec', TfsecProps),
            new TrivyAction(this, 'Trivy', ActionProps)
        ];

        const ZipProps: ZipProps = {
            ...ActionProps,
            scanActionCount: scanActions.length,
            repoName: repoName,
            branchName: props.branchName,
            TIMEOUT_MINUTES: TIMEOUT_MINUTES + 2
        };

        new Pipeline(this, 'CodePipeline', {
            pipelineName: pipelineName,
            role: CodePipelineRole,
            artifactBucket: artifactBucket,
            stages: [
                {
                    stageName: 'Source',
                    actions: [
                        new CodeCommitSourceAction({
                            actionName: 'SourceAction',
                            repository: Repository.fromRepositoryArn(
                                this,
                                'l2repo',
                                repositoryArn
                            ),
                            output: new Artifact('Artifact_Source'),
                            branch: props.branchName,
                            variablesNamespace: 'SourceVariables'
                        })
                    ]
                },
                {
                    stageName: 'validate',
                    actions: scanActions.concat([
                        new ZipAction(this, 'zipResults', ZipProps)
                    ])
                }
            ]
        });
    }
}

export class SimpleCodeScanningPipelineStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        props: SimpleCodeScanningPipelineStackProps
    ) {
        super(scope, id, props);

        // If the input properties for the stack do not specify the removal
        // policy, then define a CfnParameter to require the invoker
        // of the stack to enter the removal policy.
        //
        // The CloudFormation stack parameter exposes the ability
        // to specify whether the CodeCommit repository is retained or not
        // when/if the SimpleCodeScanningPipelineStack is destroyed or deleted.
        //
        // Make the default value RETAIN.  This is the "safe" choice,
        // in case the user has no other copy/clone/fork of the repository
        // and they were storing information in the repository that they
        // did not want to lose.

        const mainBranchName = new CfnParameter(this, 'mainBranchName', {
            default: 'main',
            type: 'String',
            description:
                "The name of the branch that should be scanned by this pipeline. Typically this is 'main', though sometimes it is named 'trunk' or 'master'. Only change this parameter if you are targeting an existing branch -- new repos all use 'main' as their primary branch."
        });
        const ExistingRepoARN = new CfnParameter(this, 'ExistingRepoARN', {
            description: [
                '[OPTIONAL] Parameter used to specify the ARN of an existing repository to use for the pipeline.',
                'If this value is left blank, a new repository will be created.',
                'Otherwise, CloudFormation will look for a repo with the provided ARN and use it as the pipeline source.',
                '\n\nNOTE: You will need to create cfn_templates, config_rules, and terraform_files directories ',
                'and add the CFN templates, Config rules, and Terraform files to the respective folders if you want to use the associated CodeBuild actions for those types of code.',
                ' Alternatively, you can change the target folders of the CodeBuild actions.'
            ].join(' '),
            type: 'String',
            default: ''
        });

        const CreateNewRepoCondition = new CfnCondition(
            this,
            'HasRepoCondition',
            {
                expression: Fn.conditionEquals(
                    ExistingRepoARN.valueAsString,
                    ''
                )
            }
        );

        const NewRepoName = new CfnParameter(this, 'NewRepoName', {
            description:
                'If creating a new repository, the name of the repository to create. The last 4 digits of the account ID will be appended to this name to create a unique repo name. Will be ignored if specifying an existing repo ARN.',
            default: 'scsp-repo',
            type: 'String'
        });

        const checkovSeverityTrigger = new CfnParameter(
            this,
            'checkovSeverityTrigger',
            {
                description:
                    'The minimum severity Checkov finding that should trigger a pipeline failure. Allowed options are LOW, MEDIUM, HIGH, CRITICAL.',
                default: 'HIGH',
                type: 'String',
                allowedValues: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
            }
        );

        const cfnTemplatesPath = new CfnParameter(this, 'cfnTemplatesPath', {
            description:
                'Used to point the pipeline to the location(s) where CloudFormation templates are located. Path is relative to the repo root.',
            default: 'cfn_templates',
            type: 'String'
        });

        const terraformCodePath = new CfnParameter(this, 'terraformCodePath', {
            description:
                'Used to point the pipeline to the location(s) where Terraform code is located. Path is relative to the repo root.',
            default: 'terraform_files',
            type: 'String'
        });

        const configRulesPath = new CfnParameter(this, 'configRulesPath', {
            description:
                'Used to point the pipeline to the location(s) where Config rules are located. Path is relative to the repo root.',
            default: 'config_rules',
            type: 'String'
        });

        const SqlDialect = new CfnParameter(this, 'sqlDialect', {
            description: `If you don't have SQL files in your repo, just leave this as the default. If you have .sql files in your repository, they will be scanned by SQLFluff using this dialect.`,
            default: 'mysql',
            allowedValues: [
                'ansi',
                'athena',
                'bigquery',
                'clickhouse',
                'databricks',
                'db2',
                'exasol',
                'hive',
                'mysql',
                'oracle',
                'postgres',
                'redshift',
                'snowflake',
                'soql',
                'sparksql',
                'sqlite',
                'teradata',
                'tsql'
            ],
            type: 'String'
        });

        const tfsecExcludeList = new CfnParameter(this, 'tfsecExcludeList', {
            description:
                'Provide comma-separated list of Tfsec rule IDs to exclude from run (Use "long_id", eg. "aws-s3-enable-bucket-logging").',
            default: ''
        });
        // semgrep config parameters
        const SemgrepConfigList = new CfnParameter(this, 'SemgrepConfig', {
            type: 'CommaDelimitedList',
            description:
                "Semgrep scan config. Defaults to auto which fetches rules for your project from the Semgrep Registry (Don't use auto if entering custom rules). Check https://semgrep.dev/explore for custom rules. ",
            default: 'auto'
        });

        const SemgrepConfig = Fn.join(
            ' --config ',
            SemgrepConfigList.valueAsList
        );

        // Ensures "auto" is not passed with other Semgrep config rules
        new CfnTemplateRule(this, 'SemGrepConfigValidator', {
            assertions: [
                {
                    assert: Fn.conditionOr(
                        Fn.conditionNot(
                            Fn.conditionContains(
                                SemgrepConfigList.valueAsList,
                                'auto'
                            )
                        ),
                        Fn.conditionAnd(
                            Fn.conditionContains(
                                SemgrepConfigList.valueAsList,
                                'auto'
                            ),
                            Fn.conditionEachMemberEquals(
                                SemgrepConfigList.valueAsList,
                                'auto'
                            )
                        )
                    ),
                    assertDescription:
                        'Semgrep config parameter error: Cannot use auto with other Semgrep config rules'
                }
            ]
        });

        const SemgrepSeverityList = new CfnParameter(this, 'SemgrepSeverity', {
            type: 'CommaDelimitedList',
            description:
                'Report findings only from rules matching the supplied severity level. Select from INFO|WARNING|ERROR separated by comma. Defaults to WARNING and ERROR ',
            default: 'ERROR,WARNING'
        });

        // ensures entered severity values are valid
        new CfnTemplateRule(this, 'SemGrepSeverityValidator', {
            assertions: [
                {
                    assert: Fn.conditionEachMemberIn(
                        SemgrepSeverityList.valueAsList,
                        ['INFO', 'WARNING', 'ERROR']
                    ),
                    assertDescription:
                        'Semgrep severity parameter error: Select from INFO|WARNING|ERROR separated by comma. '
                }
            ]
        });

        const SemgrepSeverity = Fn.join(
            ' --severity ',
            SemgrepSeverityList.valueAsList
        );
        const JSHintExcludeList = new CfnParameter(this, 'JSHintExcludeList', {
            description:
                "Allows you to specify directories which you DON'T want to be linted by JSHint.",
            default: '',
            type: 'String'
        });

        new CfnCondition(this, 'NotfsecExclude', {
            expression: Fn.conditionEquals(tfsecExcludeList.valueAsString, '')
        });

        const tfsecExclude = Fn.conditionIf(
            'NotfsecExclude',
            Fn.ref('AWS::NoValue'),
            Fn.join(' ', [' -e', tfsecExcludeList.valueAsString])
        ).toString();

        const tfsecSeverity = new CfnParameter(this, 'tfsecSeverity', {
            description:
                'The minimum severity of Tfsec findings to report. One of CRITICAL, HIGH, MEDIUM, LOW.',
            default: 'HIGH',
            type: 'String',
            allowedValues: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
        });

        new CfnCondition(this, 'NoJSHintExclude', {
            expression: Fn.conditionEquals(JSHintExcludeList.valueAsString, '')
        });

        const JSHintExclude = Fn.conditionIf(
            'NoJSHintExclude',
            Fn.ref('AWS::NoValue'),
            Fn.join(' ', [' --exclude', JSHintExcludeList.valueAsString])
        ).toString();

        const JSHintConfigList = new CfnParameter(this, 'JSHintConfigList', {
            description:
                'JSHint liniting options. Leave empty to apply all rules. To see a list of rules, visit https://jshint.com/docs/options/',
            default: '',
            type: 'CommaDelimitedList'
        });

        new CfnCondition(this, 'JSHintConfigEntered', {
            expression: Fn.conditionEquals(
                Fn.join('', JSHintConfigList.valueAsList),
                ''
            )
        });

        const JSHintConfigFlag = Fn.conditionIf(
            'JSHintConfigEntered',
            Fn.ref('AWS::NoValue'),
            ' --config ./config.json'
        ).toString();

        const JSHintConfigFile = Fn.conditionIf(
            'JSHintConfigEntered',
            Fn.ref('AWS::NoValue'),
            Fn.join('', [
                '"{\\"',
                Fn.join('', [
                    Fn.join(
                        '\\"- true, \\"',
                        JSHintConfigList.valueAsList
                    ).toString(),
                    '\\"- true}"'
                ]).toString()
            ])
        ).toString();

        // Ensure that only ONE of Existing/New name are provided
        const A = Fn.conditionEquals('', ExistingRepoARN.valueAsString);
        const B = Fn.conditionEquals('', NewRepoName.valueAsString);
        new CfnTemplateRule(this, 'NoNewAndExisting', {
            assertions: [
                {
                    // XOR = (NOT(A AND B)) AND (NOT(NOT A AND NOT B))
                    // Assertions should be TRUE
                    assert: Fn.conditionAnd(
                        // // Both should not be Empty
                        Fn.conditionNot(Fn.conditionAnd(A, B)),
                        // Both should not be populated
                        Fn.conditionNot(
                            Fn.conditionAnd(
                                Fn.conditionNot(A),
                                Fn.conditionNot(B)
                            )
                        )
                    ),
                    assertDescription:
                        'Cannot specify both a new and existing repository. '
                }
            ]
        });

        const BaseResourceProperties = {
            branchName: mainBranchName.valueAsString,
            createNewRepo: CreateNewRepoCondition,
            existingRepoARN: ExistingRepoARN.valueAsString,
            NewRepoName: NewRepoName.valueAsString,
            sqlDialect: SqlDialect.valueAsString,
            starterZip: props.starterZip,
            cfnTemplatesPath: cfnTemplatesPath.valueAsString,
            terraformCodePath: terraformCodePath.valueAsString,
            configRulesPath: configRulesPath.valueAsString,
            tfsecExclude: tfsecExclude,
            tfsecSeverity: tfsecSeverity.valueAsString,
            SemgrepConfig: SemgrepConfig,
            SemgrepSeverity: SemgrepSeverity,
            checkovSeverityTrigger: checkovSeverityTrigger.valueAsString,
            JSHintExclude: JSHintExclude,
            JSHintConfigFile: JSHintConfigFile,
            JSHintConfigFlag: JSHintConfigFlag
        };
        if (props.removalPolicy == null) {
            // props.removalPolicy is null or undefined

            // If not set on input to the Stack creation, then create
            // a parameter to do late resolution on this.

            const RetentionPolicy = new CfnParameter(this, 'RetentionPolicy', {
                allowedValues: ['Retain', 'Delete'],
                default: 'Delete',
                description: [
                    'Retention setting for the CodeCommit repository and CloudWatch Log groups when the Stack is deleted.',
                    'Setting this to Retain can be useful to avoid accidentally deleting data,',
                    'but can make it more difficult to destroy/redeploy the stack.',
                    'Because the CodeCommit repository which is created is considered ephemeral and transient,',
                    'the default setting is Delete.'
                ].join(' '),
                type: 'String'
            });

            const RetainCondition = new CfnCondition(this, 'RetainCondition', {
                expression: Fn.conditionEquals(
                    RetentionPolicy.valueAsString,
                    'Retain'
                )
            });

            const DeleteCondition = new CfnCondition(this, 'DeleteCondition', {
                expression: Fn.conditionEquals(
                    RetentionPolicy.valueAsString,
                    'Delete'
                )
            });

            new ConditionalSimpleCodeScanningPipelineResources(
                this,
                'RetainResources',
                {
                    ...BaseResourceProperties,
                    removalPolicy: RemovalPolicy.RETAIN,
                    condition: RetainCondition
                }
            );

            new ConditionalSimpleCodeScanningPipelineResources(
                this,
                'DeleteResources',
                {
                    ...BaseResourceProperties,
                    removalPolicy: RemovalPolicy.DESTROY,
                    condition: DeleteCondition
                }
            );
        } else {
            new SimpleCodeScanningPipelineResources(this, 'PipelineResources', {
                ...BaseResourceProperties,
                removalPolicy: props.removalPolicy
            });
        }
    }
}
