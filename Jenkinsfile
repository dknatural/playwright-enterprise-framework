
pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 45, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(
            numToKeepStr: '20',
            artifactNumToKeepStr: '10'
        ))
        skipDefaultCheckout(true)
    }

    parameters {
        choice(
            name: 'TARGET_ENV',
            choices: ['local', 'staging', 'qa'],
            description: 'Target test environment'
        )

        choice(
            name: 'BROWSER',
            choices: ['chromium', 'firefox', 'webkit', 'all'],
            description: 'Browser project'
        )

        string(
            name: 'EMAIL_RECIPIENTS',
            defaultValue: 'deepakkhadkaqa@gmail.com',
            description: 'Email addresses separated by commas'
        )
    }

    environment {
        CI = 'true'
        HEADLESS = 'true'
        BASE_URL = 'https://opensource-demo.orangehrmlive.com'
        API_BASE_URL = 'http://localhost:3000/api'
        TEST_ENV = "${params.TARGET_ENV}"
    }

    stages {

        stage('Checkout GitHub') {
            steps {
                checkout scm
            }
        }

        stage('Verify Tools') {
            steps {
                bat 'node --version'
                bat 'npm --version'
                bat 'java -version'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm ci --no-audit --no-fund'

                script {
                    if (params.BROWSER == 'all') {
                        bat 'npx playwright install chromium firefox webkit'
                    } else {
                        bat "npx playwright install ${params.BROWSER}"
                    }
                }
            }
        }

        stage('TypeScript Validation') {
            steps {
                bat 'npm run typecheck'
            }
        }

        stage('Run Playwright Tests') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'orangehrm-username',
                        variable: 'ORANGEHRM_USERNAME'
                    ),
                    string(
                        credentialsId: 'orangehrm-password',
                        variable: 'ORANGEHRM_PASSWORD'
                    )
                ]) {
                    script {
                        def projectArg = params.BROWSER == 'all'
                            ? ''
                            : "--project=${params.BROWSER}"

                        bat 'npm run allure:clean'

                        bat "npx playwright test ${projectArg}"
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                if (fileExists('allure-results')) {
                    try {
                        allure(
                            includeProperties: false,
                            jdk: '',
                            results: [[path: 'allure-results']]
                        )
                    } catch (Exception e) {
                        echo "Allure publishing failed: ${e.message}"
                    }
                } else {
                    echo 'No Allure results directory found.'
                }
            }

            junit(
                allowEmptyResults: true,
                testResults: 'test-results/junit.xml'
            )

            archiveArtifacts(
                allowEmptyArchive: true,
                artifacts: 'allure-results/**,playwright-report/**,test-results/**',
                fingerprint: true
            )
        }

        success {
            emailext(
                subject: "SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """Playwright Automation Completed Successfully.

Job: ${env.JOB_NAME}
Build: ${env.BUILD_NUMBER}
Environment: ${params.TARGET_ENV}
Browser: ${params.BROWSER}
Status: SUCCESS

Build URL:
${env.BUILD_URL}

Allure Report:
${env.BUILD_URL}allure/
""",
                to: params.EMAIL_RECIPIENTS
            )
        }

        failure {
            emailext(
                subject: "FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """Playwright Automation Failed.

Job: ${env.JOB_NAME}
Build: ${env.BUILD_NUMBER}
Environment: ${params.TARGET_ENV}
Browser: ${params.BROWSER}
Status: FAILURE

Build URL:
${env.BUILD_URL}

Allure Report:
${env.BUILD_URL}allure/

Console Output:
${env.BUILD_URL}console
""",
                to: params.EMAIL_RECIPIENTS
            )
        }
    }
}