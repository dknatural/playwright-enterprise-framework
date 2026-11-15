pipeline {
  agent {
    docker {
      // Match this image version to the installed @playwright/test version.
      image 'mcr.microsoft.com/playwright:v1.58.0-noble'
      args '--ipc=host'
      reuseNode true
    }
  }
  options {
    timestamps()
    timeout(time: 45, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
  }
  parameters {
    choice(name: 'TARGET_ENV', choices: ['staging', 'qa'], description: 'Non-production target environment')
    choice(name: 'BROWSER', choices: ['chromium', 'firefox', 'webkit', 'all'], description: 'Browser project')
  }
  environment {
    CI = 'true'
    HEADLESS = 'true'
    // Set URLs and non-secret DB settings in Jenkins folder/job configuration.
    // BASE_URL, API_BASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_SSL
  }
  stages {
    stage('Install') {
      steps {
        sh 'node --version && npm install --no-audit --no-fund'
      }
    }
    stage('Typecheck') {
      steps { sh 'npm run typecheck' }
    }
    stage('Test') {
      steps {
        withCredentials([
          string(credentialsId: 'pw-api-token', variable: 'API_TOKEN'),
          string(credentialsId: 'pw-db-password', variable: 'DB_PASSWORD')
        ]) {
          script {
            def projectArg = params.BROWSER == 'all' ? '' : "--project=${params.BROWSER}"
            withEnv(["TEST_ENV=${params.TARGET_ENV}"]) {
              sh "npx playwright test ${projectArg}"
            }
          }
        }
      }
    }
  }
  post {
    always {
      junit allowEmptyResults: true, testResults: 'test-results/junit.xml'
      archiveArtifacts allowEmptyArchive: true, artifacts: 'playwright-report/**,test-results/**', fingerprint: true
      // Install Jenkins HTML Publisher plugin to expose a browsable report:
      // publishHTML(target: [reportDir: 'playwright-report', reportFiles: 'index.html', reportName: 'Playwright HTML', keepAll: true, allowMissing: true])
      cleanWs(deleteDirs: true, disableDeferredWipeout: true)
    }
  }
}
