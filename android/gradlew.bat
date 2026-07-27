@rem
@rem Copyright 2015 the original author or authors.
@rem Licensed under the Apache License, Version 2.0 (the "License");
@rem you may not use this file except in compliance with the License.
@rem You may obtain a copy of the License at
@rem
@rem      https://www.apache.org/licenses/LICENSE-2.0
@rem
@rem Unless required by applicable law or agreed to in writing, software
@rem distributed under the License is distributed on an "AS IS" BASIS,
@rem WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
@rem See the License for the specific language governing permissions and
@rem limitations under the License.
@rem

@if "%DEBUG%"=="" @echo off
@rem ##########################################################################
@rem
@rem  Gradle startup script for Windows
@rem
@rem ##########################################################################

@rem Set local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" setlocal

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%

@rem Add default JVM options here. You can also use JAVA_OPTS and GRADLE_OPTS to pass JVM options to this script.
set DEFAULT_JVM_OPTS="-Xmx64m" "-Xms64m"

@rem Best-effort Java detection and MSYS-style JAVA_HOME normalization.
set _JAVA_EXE=java.exe
set _JAVA_CMD=
if defined JAVA_HOME set _JAVA_CMD=%JAVA_HOME%\bin\java.exe
if exist "%_JAVA_CMD%" goto initProjectEnv

if not defined JAVA_HOME goto findJavaFromJavaHome
set _POSSIBLE_JAVA_HOME=%JAVA_HOME:/c\=C:%
if exist "%_POSSIBLE_JAVA_HOME%\bin\java.exe" (
  set JAVA_HOME=%_POSSIBLE_JAVA_HOME%
  set _JAVA_CMD=%JAVA_HOME%\bin\java.exe
  goto initProjectEnv
)

:findJavaFromJavaHome
echo.
echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME%
echo.
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java installation.

goto fail

:initProjectEnv
if not defined _JAVA_CMD set _JAVA_CMD=%_JAVA_EXE%
set CLASSPATH=%APP_HOME%gradle\wrapper\gradle-wrapper.jar

@rem Execute Gradle
"%_JAVA_CMD%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*

:end
@rem End local scope for the variables with windows NT shell
endlocal

:omega
exit /b %ERRORLEVEL%

:fail
exit /b 1
