# Build one selected service and its shared library dependencies from the Maven reactor.
FROM maven:3.9-eclipse-temurin-17 AS build
ARG SERVICE=property-service
WORKDIR /build
COPY pom.xml .
COPY shared ./shared
COPY services ./services
RUN mvn -B -pl services/${SERVICE} -am package -DskipTests

# The same image can run in dev, UAT, or prod through runtime environment variables.
FROM eclipse-temurin:17-jre
ARG SERVICE=property-service
WORKDIR /app
ENV SERVER_PORT=8080 MANAGEMENT_PORT=9090 SERVER_ADDRESS=0.0.0.0
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70.0 -XX:+ExitOnOutOfMemoryError"
RUN mkdir -p /app/data /app/logs && chown -R 10001:10001 /app
COPY --from=build /build/services/${SERVICE}/target/${SERVICE}-0.0.1-SNAPSHOT.jar /app/app.jar
USER 10001:10001
EXPOSE 8080 9090
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
