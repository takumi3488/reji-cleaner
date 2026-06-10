import {
	type Meter,
	metrics,
	type Span,
	type SpanOptions,
	SpanStatusCode,
	type Tracer,
	trace,
} from "@opentelemetry/api";
import { type Logger, logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import {
	defaultResource,
	resourceFromAttributes,
} from "@opentelemetry/resources";
import {
	BatchLogRecordProcessor,
	LoggerProvider,
} from "@opentelemetry/sdk-logs";
import {
	MeterProvider,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
	BatchSpanProcessor,
	NodeTracerProvider,
} from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const SERVICE_NAME = Bun.env.OTEL_SERVICE_NAME || "reji-cleaner";

// Without an explicit endpoint the exporters would silently retry against
// the default http://localhost:4318 and delay process exit by ~10s, so
// telemetry stays disabled (no-op providers) unless one is configured.
const telemetryEnabled = Boolean(
	Bun.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
		Bun.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
		Bun.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
		Bun.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
);

let tracerProvider: NodeTracerProvider | undefined;
let meterProvider: MeterProvider | undefined;
let loggerProvider: LoggerProvider | undefined;

if (telemetryEnabled) {
	// OTLP exporters read OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_EXPORTER_OTLP_HEADERS
	// from the environment automatically; only the resource is configured here.
	const resource = defaultResource().merge(
		resourceFromAttributes({ [ATTR_SERVICE_NAME]: SERVICE_NAME }),
	);

	tracerProvider = new NodeTracerProvider({
		resource,
		spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
	});
	tracerProvider.register();

	meterProvider = new MeterProvider({
		resource,
		readers: [
			new PeriodicExportingMetricReader({
				exporter: new OTLPMetricExporter(),
				exportIntervalMillis: Number.parseInt(
					Bun.env.OTEL_METRIC_EXPORT_INTERVAL || "60000",
					10,
				),
			}),
		],
	});
	metrics.setGlobalMeterProvider(meterProvider);

	loggerProvider = new LoggerProvider({
		resource,
		processors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
	});
	logs.setGlobalLoggerProvider(loggerProvider);
}

export const tracer: Tracer = trace.getTracer(SERVICE_NAME);
export const meter: Meter = metrics.getMeter(SERVICE_NAME);
export const otelLogger: Logger = logs.getLogger(SERVICE_NAME);

// Run fn inside an active span, recording failures on it and always ending it
export async function withSpan<T>(
	name: string,
	options: SpanOptions,
	fn: (span: Span) => Promise<T>,
): Promise<T> {
	return tracer.startActiveSpan(name, options, async (span) => {
		try {
			return await fn(span);
		} catch (error) {
			span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
			throw error;
		} finally {
			span.end();
		}
	});
}

// Flush pending telemetry before the process exits (required for a
// short-lived CLI; batch processors hold data in memory otherwise).
export async function shutdownTelemetry(): Promise<void> {
	await Promise.allSettled([
		tracerProvider?.shutdown(),
		meterProvider?.shutdown(),
		loggerProvider?.shutdown(),
	]);
}
