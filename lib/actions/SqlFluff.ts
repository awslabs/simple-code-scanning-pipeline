import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { SqlFluffProps } from '../StandardizedCodeBuildProjectProps';

export class SqlFluffAction extends CodeBuildAction {
    constructor(scope: Construct, id: string, props: SqlFluffProps) {
        const action_details: ActionDetails = {
            actionName: id,
            project: new StandardizedCodeBuildProject(
                scope,
                id,
                Object.assign({}, props, {
                    projectName: id,
                    description: 'Runs linting on .sql files',
                    installCommands: ['pip install sqlfluff'],
                    buildCommands: [
                        [
                            `find . -type f -name "*.sql" -print0 | while read -d '' -r SQLSCRIPT; do`,
                            `    OUTPUT=$(sqlfluff lint $SQLSCRIPT --dialect ${props.sqlDialect} --exclude-rules L016) # exclude line length check`,
                            `    if (( $? )) ; then`,
                            `        touch sqlflufferror.inf`, // Need to "write" the presence of an error to a file since the piping to `while read` creates a new subshell with a different variable scope
                            `    fi`,
                            `    echo "$OUTPUT" | tee -a ${id}.tmp`,
                            `done`
                        ].join('\n'),
                        `echo "If you have many errors to fix then consider using the command 'sqlfluff fix' to autofix certain problems" | tee -a ${id}.tmp`,
                        [
                            `if [[ -e sqlflufferror.inf ]] ; then`,
                            `    EXITCODE=1`,
                            `else`,
                            `    EXITCODE=0`,
                            `fi`
                        ].join('\n'),
                        `mv ${id}.tmp ${id}.log`
                    ]
                })
            )
        };
        super(Object.assign({}, props, ActionDefaultSettings, action_details));
    }
}
