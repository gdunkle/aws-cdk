import * as path from 'path';
import { Template } from '../../assertions';
import * as lambda from '../../aws-lambda';
import * as cdk from '../../core';
import * as appsync from '../lib';

// GLOBAL GIVEN
let stack: cdk.Stack;
let api: appsync.GraphqlApi;
beforeEach(() => {
  stack = new cdk.Stack();
  api = new appsync.GraphqlApi(stack, 'baseApi', {
    name: 'api',
    schema: appsync.SchemaFile.fromAsset(path.join(__dirname, 'appsync.test.graphql')),
  });
});

describe('Lambda Data Source configuration', () => {
  // GIVEN
  let func: lambda.Function;
  beforeEach(() => {
    func = new lambda.Function(stack, 'func', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'verify/iam-query')),
      handler: 'iam-query.handler',
      runtime: lambda.Runtime.NODEJS_14_X,
    });
  });

  test('default configuration produces name `TableCDKDataSource`', () => {
    // WHEN
    api.addLambdaDataSource('ds', func);

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
      Name: 'ds',
    });
  });

  test('appsync configures name correctly', () => {
    // WHEN
    api.addLambdaDataSource('ds', func, {
      name: 'custom',
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
      Name: 'custom',
    });
  });

  test('appsync configures name and description correctly', () => {
    // WHEN
    api.addLambdaDataSource('ds', func, {
      name: 'custom',
      description: 'custom description',
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
      Name: 'custom',
      Description: 'custom description',
    });
  });

  test('appsync sanitized datasource name from unsupported characters', () => {
    const badCharacters = [...'!@#$%^&*()+-=[]{}\\|;:\'",<>?/'];

    badCharacters.forEach((badCharacter) => {
      // WHEN
      const newStack = new cdk.Stack();
      const graphqlapi = new appsync.GraphqlApi(newStack, 'baseApi', {
        name: 'api',
        schema: appsync.SchemaFile.fromAsset(path.join(__dirname, 'appsync.test.graphql')),
      });
      const dummyFunction = new lambda.Function(newStack, 'func', {
        code: lambda.Code.fromAsset(path.join(__dirname, 'verify/iam-query')),
        handler: 'iam-query.handler',
        runtime: lambda.Runtime.NODEJS_14_X,
      });
      graphqlapi.addLambdaDataSource(`data-${badCharacter}-source`, dummyFunction);

      // THEN
      Template.fromStack(newStack).hasResourceProperties('AWS::AppSync::DataSource', {
        Type: 'AWS_LAMBDA',
        Name: 'datasource',
      });
    });
  });

  test('appsync leaves underscore untouched in datasource name', () => {
    // WHEN
    api.addLambdaDataSource('data_source', func);

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
      Name: 'data_source',
    });
  });

  test('appsync errors when creating multiple lambda data sources with no configuration', () => {
    // THEN
    expect(() => {
      api.addLambdaDataSource('ds', func);
      api.addLambdaDataSource('ds', func);
    }).toThrow("There is already a Construct with name 'ds' in GraphqlApi [baseApi]");
  });

  test('lambda data sources dont require mapping templates', () => {
    // WHEN
    const ds = api.addLambdaDataSource('ds', func, {
      name: 'custom',
      description: 'custom description',
    });

    ds.createResolver('TestField', {
      typeName: 'test',
      fieldName: 'field',
    });

    // THEN
    Template.fromStack(stack).resourceCountIs('AWS::AppSync::Resolver', 1);
  });
});

describe('adding lambda data source from imported api', () => {
  let func: lambda.Function;
  beforeEach(() => {
    func = new lambda.Function(stack, 'func', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'verify/iam-query')),
      handler: 'iam-query.handler',
      runtime: lambda.Runtime.NODEJS_14_X,
    });
  });

  test('imported api can add LambdaDbDataSource from id', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
    });
    importedApi.addLambdaDataSource('ds', func);

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });

  test('imported api can add LambdaDataSource from attributes', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
      graphqlApiArn: api.arn,
    });
    importedApi.addLambdaDataSource('ds', func);

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });
});
