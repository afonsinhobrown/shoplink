export const dynamic = "force-dynamic";

export default async function EntregasNovaRedirect({
  searchParams,
}: {
  searchParams: Promise<{ entregador?: string; lat?: string; lng?: string }>;
}) {
  const params = await searchParams;
  const entregador = params.entregador;
  const lat = params.lat;
  const lng = params.lng;

  const deliverySystemBase = process.env.NEXT_PUBLIC_DELIVERY_SYSTEM_URL || "https://entregasmoz.vercel.app";
  const url = `${deliverySystemBase}/entregadores/solicitar?entregadorId=${entregador}`;

  return (
    <html>
      <head>
        <title>A redirecionar para o sistema de entregas…</title>
        <meta httpEquiv="refresh" content={`0;url=${url}`} />
        <script dangerouslySetInnerHTML={{ __html: `window.location.href = "${url}";` }} />
      </head>
      <body>
        <p>A redirecionar para o sistema de entregas… <a href={url}>Clique aqui se não for redirecionado</a></p>
      </body>
    </html>
  );
}