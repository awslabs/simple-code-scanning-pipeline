import { Construct } from 'constructs';
import { CfnResource, CfnCondition } from 'aws-cdk-lib';
import { stderr } from 'process';

// The function below traverses the sub-tree of resources
// in the Construct and applies the specified condition to those resources.
//
// A more elegant way to do this is by using the Aspects construct
// and creating a class which implemented IApsect, providing a visit method.
//
export function add_condition_to_tree(
    constructItem: Construct,
    condition: CfnCondition
) {
    if (constructItem instanceof CfnResource) {
        const resourceItem = constructItem as CfnResource;
        resourceItem.cfnOptions.condition = condition;
    }
    if (constructItem.node.children.length > 0) {
        for (const childItem of constructItem.node.children) {
            add_condition_to_tree(childItem, condition);
        }
    }
}

// This utility function can be useful to visualize what the Construct
// tree contains at any time during the construction of the application.
// The contents of the Construct tree can change as resources are added
// to the application.
//
export function dump_tree(constructItem: Construct, title: string) {
    stderr.write(title + '\n');
    dump_subtree(constructItem, 0);
}

// This function is a recursive function that walks through the Node tree
// and prints to stderr selected information about the node, when the node
// is a CfnResource type.
//
function dump_subtree(constructItem: Construct, indent: number) {
    let prefix = '';
    for (let i = 0; i < indent; i++) {
        prefix = prefix + ' ';
    }
    stderr.write(
        prefix +
            '->Node name is: ' +
            constructItem.node.id +
            ' with ' +
            constructItem.node.children.length +
            ' children\n'
    );
    if (constructItem instanceof CfnResource) {
        const resourceItem = constructItem as CfnResource;
        stderr.write(
            prefix +
                '  Construct Type is: ' +
                resourceItem.cfnResourceType +
                '\n'
        );
        if (resourceItem.cfnOptions.condition != null) {
            stderr.write(
                prefix +
                    '  cfnOptions.condition=' +
                    resourceItem.cfnOptions.condition.logicalId +
                    '\n'
            );
        } else {
            stderr.write(prefix + '  cfnOptions.condition=null\n');
        }
    } else {
        stderr.write(
            prefix + '  Construct Type is: ' + typeof constructItem + '\n'
        );
    }
    // stderr.write(prefix+"  Node path is: "+nodeItem.path+"\n")
    if (constructItem.node.children.length > 0) {
        for (const childItem of constructItem.node.children) {
            dump_subtree(childItem, indent + 1);
        }
    } else {
        stderr.write(prefix + '  item has no children\n');
    }
}
