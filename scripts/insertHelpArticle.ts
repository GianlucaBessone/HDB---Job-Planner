import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Upsert Category
    const category = await prisma.helpCategory.upsert({
        where: { slug: 'seguridad' },
        update: {
            title: 'Seguridad y Privacidad',
            description: 'Información sobre cómo protegemos tus datos y garantizamos la integridad del sistema.',
            iconName: 'ShieldCheck'
        },
        create: {
            slug: 'seguridad',
            title: 'Seguridad y Privacidad',
            description: 'Información sobre cómo protegemos tus datos y garantizamos la integridad del sistema.',
            iconName: 'ShieldCheck',
            order: 5
        }
    });

    // Upsert Article
    await prisma.helpArticle.upsert({
        where: { slug: 'verificacion-firmas' },
        update: {
            title: 'Verificación de Firmas y Hashes Criptográficos',
            description: 'Comprende cómo funciona el motor de firmas criptográficas, qué es un Hash HMAC SHA-256 y por qué garantiza el No-Repudio y la inalterabilidad de los documentos.',
            content: `
### ¿Para qué sirve la Verificación de Firmas?

Esta vista tiene un propósito fundamental: **auditar matemáticamente que una firma no ha sido alterada desde el momento exacto en que fue emitida**. Comprueba en tiempo real si los datos guardados en la base de datos coinciden exactamente con la realidad registrada (tu DNI, el documento, la hora exacta, y tu dispositivo).

---

### ¿Qué es un Hash?

Imagina un Hash como una "huella dactilar" o un "sello criptográfico". Es una cadena de texto alfanumérica única (por ejemplo: \`a2c4e6...\`) que se genera a partir de un conjunto de datos específicos. 

La magia de un Hash es que es **determinístico y extremadamente sensible a los cambios**: si cambias una sola coma, un segundo en la hora, o una letra en el nombre, el Hash resultante cambia por completo.

---

### ¿Qué algoritmo de seguridad utilizamos?

En HDB SGI utilizamos **HMAC SHA-256**, un estándar de seguridad de nivel bancario.

A diferencia de un Hash simple, un HMAC (Hash-based Message Authentication Code) cifra y mezcla tus datos con una **Llave Secreta** que solo existe encriptada dentro de los servidores de producción de la empresa.

Esto hace que sea **imposible** que alguien (incluso con acceso profundo a la base de datos) invente o falsifique un Hash válido para un documento.

---

### ¿Cómo asegura la inalterabilidad? (Ejemplo Práctico)

1. **Momento de la Firma:** Imagina que firmas la **Versión 1.0** de un documento el **12 de Mayo**. El sistema toma tu DNI, esa versión y esa fecha, y junto a la Llave Secreta del servidor genera el Hash \`8f1b...\`.
2. **Intento de Fraude:** Si más adelante alguien malintencionado intenta entrar a la base de datos y edita el registro "a la fuerza" para decir que tú en realidad aprobaste la **Versión 2.0** o modifica la fecha al **15 de Mayo**.
3. **Verificación Incorruptible:** Cuando abras esta vista, el sistema intentará recalcular el Hash con esos nuevos datos falsos. El nuevo cálculo dará \`3x9p...\`.
4. **Alerta Inmediata:** Al no coincidir el Hash recalculado (\`3x9p...\`) con el Hash original guardado (\`8f1b...\`), el sistema expone el fraude y muestra la alerta de **DATOS MODIFICADOS**.

Gracias a esto, ni el empleado puede repudiar su firma legítima, ni la empresa puede alterar un documento ya firmado.
            `,
            comoAcceder: 'Abre cualquier documento firmado, dirígete a la sección de Estado de Firmas, y haz clic en el botón "Ver Firma Digital".',
            objetivo: 'Entender el concepto de Hash y cómo garantiza la seguridad de las firmas electrónicas.',
            roles: ['todos'],
            relatedModules: ['documentos', 'calidad'],
            isPublished: true,
            categoryId: category.id
        },
        create: {
            slug: 'verificacion-firmas',
            title: 'Verificación de Firmas y Hashes Criptográficos',
            description: 'Comprende cómo funciona el motor de firmas criptográficas, qué es un Hash HMAC SHA-256 y por qué garantiza el No-Repudio y la inalterabilidad de los documentos.',
            content: `
### ¿Para qué sirve la Verificación de Firmas?

Esta vista tiene un propósito fundamental: **auditar matemáticamente que una firma no ha sido alterada desde el momento exacto en que fue emitida**. Comprueba en tiempo real si los datos guardados en la base de datos coinciden exactamente con la realidad registrada (tu DNI, el documento, la hora exacta, y tu dispositivo).

---

### ¿Qué es un Hash?

Imagina un Hash como una "huella dactilar" o un "sello criptográfico". Es una cadena de texto alfanumérica única (por ejemplo: \`a2c4e6...\`) que se genera a partir de un conjunto de datos específicos. 

La magia de un Hash es que es **determinístico y extremadamente sensible a los cambios**: si cambias una sola coma, un segundo en la hora, o una letra en el nombre, el Hash resultante cambia por completo.

---

### ¿Qué algoritmo de seguridad utilizamos?

En HDB SGI utilizamos **HMAC SHA-256**, un estándar de seguridad de nivel bancario.

A diferencia de un Hash simple, un HMAC (Hash-based Message Authentication Code) cifra y mezcla tus datos con una **Llave Secreta** que solo existe encriptada dentro de los servidores de producción de la empresa.

Esto hace que sea **imposible** que alguien (incluso con acceso profundo a la base de datos) invente o falsifique un Hash válido para un documento.

---

### ¿Cómo asegura la inalterabilidad? (Ejemplo Práctico)

1. **Momento de la Firma:** Imagina que firmas la **Versión 1.0** de un documento el **12 de Mayo**. El sistema toma tu DNI, esa versión y esa fecha, y junto a la Llave Secreta del servidor genera el Hash \`8f1b...\`.
2. **Intento de Fraude:** Si más adelante alguien malintencionado intenta entrar a la base de datos y edita el registro "a la fuerza" para decir que tú en realidad aprobaste la **Versión 2.0** o modifica la fecha al **15 de Mayo**.
3. **Verificación Incorruptible:** Cuando abras esta vista, el sistema intentará recalcular el Hash con esos nuevos datos falsos. El nuevo cálculo dará \`3x9p...\`.
4. **Alerta Inmediata:** Al no coincidir el Hash recalculado (\`3x9p...\`) con el Hash original guardado (\`8f1b...\`), el sistema expone el fraude y muestra la alerta de **DATOS MODIFICADOS**.

Gracias a esto, ni el empleado puede repudiar su firma legítima, ni la empresa puede alterar un documento ya firmado.
            `,
            comoAcceder: 'Abre cualquier documento firmado, dirígete a la sección de Estado de Firmas, y haz clic en el botón "Ver Firma Digital".',
            objetivo: 'Entender el concepto de Hash y cómo garantiza la seguridad de las firmas electrónicas.',
            roles: ['todos'],
            relatedModules: ['documentos', 'calidad'],
            isPublished: true,
            categoryId: category.id
        }
    });
    
    console.log("Help Article Upserted Successfully");
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(() => {
    prisma.$disconnect();
});
