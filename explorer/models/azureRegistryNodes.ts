/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ContainerModels from 'azure-arm-containerregistry/lib/models';
import { SubscriptionModels } from 'azure-arm-resource';
import * as path from 'path';
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import { imagesPath } from '../../constants';
import { AzureAccount } from '../../typings/azure-account.api';
import { getImagesByRepository, getRepositoriesByRegistry } from '../../utils/Azure/acrTools';
import { AzureImage } from '../../utils/Azure/models/image';
import { Repository } from '../../utils/Azure/models/repository';
import { getLoginServer } from '../../utils/nonNull';
import { formatTag } from './commonRegistryUtils';
import { IconPath, NodeBase } from './nodeBase';
import { TaskRootNode } from './taskNode';

export class AzureRegistryNode extends NodeBase {
    constructor(
        public readonly label: string,
        public readonly azureAccount: AzureAccount,
        public readonly registry: ContainerModels.Registry,
        public readonly subscription: SubscriptionModels.Subscription
    ) {
        super(label);
    }

    public readonly contextValue: string = 'azureRegistryNode';
    public readonly iconPath: IconPath = {
        light: path.join(imagesPath, 'light', 'Registry_16x.svg'),
        dark: path.join(imagesPath, 'dark', 'Registry_16x.svg')
    };

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.label,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: this.contextValue,
            iconPath: this.iconPath
        }
    }

    public async getChildren(element: AzureRegistryNode): Promise<NodeBase[]> {
        // tslint:disable-next-line:no-this-assignment
        let me = this;
        return await callWithTelemetryAndErrorHandling('getChildren', async function (this: IActionContext): Promise<NodeBase[]> {
            this.suppressTelemetry = true;
            this.properties.source = 'azureRegistryNodes';

            const repoNodes: NodeBase[] = [];

            //Pushing single TaskRootNode under the current registry. All the following nodes added to registryNodes are type AzureRepositoryNode
            let taskNode = new TaskRootNode("Tasks", element.azureAccount, element.subscription, element.registry);
            repoNodes.push(taskNode);

            if (!me.azureAccount) {
                return [];
            }

            const repositories: Repository[] = await getRepositoriesByRegistry(element.registry);
            for (let repository of repositories) {
                let node = new AzureRepositoryNode(
                    repository.name,
                    element,
                    me.azureAccount,
                    element.subscription,
                    element.registry,
                    element.label);
                repoNodes.push(node);
            }

            //Note these are ordered by default in alphabetical order
            return repoNodes;
        });
    }
}
export class AzureRepositoryNode extends NodeBase {
    constructor(
        public readonly label: string,
        public parent: NodeBase,
        public readonly azureAccount: AzureAccount,
        public readonly subscription: SubscriptionModels.Subscription,
        public readonly registry: ContainerModels.Registry,
        public readonly repositoryName: string
    ) {
        super(label);
    }

    public static readonly contextValue: string = 'azureRepositoryNode';
    public readonly contextValue: string = AzureRepositoryNode.contextValue;
    public readonly iconPath: { light: string | vscode.Uri; dark: string | vscode.Uri } = {
        light: path.join(imagesPath, 'light', 'Repository_16x.svg'),
        dark: path.join(imagesPath, 'dark', 'Repository_16x.svg')
    };

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.label,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: this.contextValue,
            iconPath: this.iconPath
        }
    }

    public async getChildren(element: AzureRepositoryNode): Promise<AzureImageTagNode[]> {
        // tslint:disable-next-line:no-this-assignment
        let me = this;
        return await callWithTelemetryAndErrorHandling('getChildren', async function (this: IActionContext): Promise<AzureImageTagNode[]> {
            this.suppressTelemetry = true;
            this.properties.source = 'azureRepositoryNode';

            const imageNodes: AzureImageTagNode[] = [];
            let node: AzureImageTagNode;
            let repo = await Repository.Create(element.registry, element.label);
            let images: AzureImage[] = await getImagesByRepository(repo);
            for (let img of images) {
                node = new AzureImageTagNode(
                    element.azureAccount,
                    element,
                    img.subscription,
                    img.registry,
                    getLoginServer(img.registry),
                    img.repository.name,
                    img.tag,
                    img.created);
                imageNodes.push(node);
            }

            return imageNodes;
        });
    }
}

export class AzureImageTagNode extends NodeBase {
    constructor(
        public readonly azureAccount: AzureAccount,
        public readonly parent: NodeBase,
        public readonly subscription: SubscriptionModels.Subscription,
        public readonly registry: ContainerModels.Registry,
        public readonly serverUrl: string,
        public readonly repositoryName: string,
        public readonly tag: string,
        public readonly created: Date,
    ) {
        super(AzureImageTagNode.getImageNameWithTag(repositoryName, tag));
    }

    public static readonly contextValue: string = 'azureImageTagNode';
    public readonly contextValue: string = AzureImageTagNode.contextValue;

    public static getImageNameWithTag(repositoryName: string, tag: string): string {
        return `${repositoryName}:${tag}`;
    }

    public getTreeItem(): vscode.TreeItem {
        return {
            label: formatTag(this.label, this.created),
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: this.contextValue
        }
    }
}

export class AzureNotSignedInNode extends NodeBase {
    constructor() {
        super('Sign in to Azure...');
    }

    public readonly contextValue: string = 'azureNotSignedInNode';

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.label,
            command: {
                title: this.label,
                command: 'azure-account.login'
            },
            collapsibleState: vscode.TreeItemCollapsibleState.None
        }
    }
}

export class AzureLoadingNode extends NodeBase {
    constructor() {
        super('Loading...');
    }

    public readonly contextValue: string = 'azureLoadingNode';

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.label,
            collapsibleState: vscode.TreeItemCollapsibleState.None
        }
    }
}
