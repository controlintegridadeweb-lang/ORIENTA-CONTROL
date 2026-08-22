# ADR-0005 — Storage privado e validação estrutural de uploads

- **Status:** aceito
- **Data:** 2026-07-27 (atualizado em 2026-08-03)

## Contexto
Evidências podem conter documentos não confiáveis e precisam permanecer isoladas por organização e ciclo.

## Decisão
Usar bucket privado, paths determinísticos, upload assinado, restrição de formatos (PDF, PNG, JPEG, WebP), validação de extensão, MIME, tamanho, assinatura binária e estrutura. Arquivos só ficam disponíveis após validação estrutural concluída com `file_validation_status = valid`.

**A Plataforma ORIENTA não realiza varredura antimalware nesta versão.** A segurança dos uploads utiliza restrição de formatos, validação estrutural, armazenamento privado, autorização, entrega segura e auditoria.

## Alternativas consideradas
- Bucket público: descartado por expor documentos institucionais.
- Liberar arquivos antes da validação estrutural: descartado por permitir conteúdo malformado ou incompatível.
- Varredura antimalware integrada (ClamAV): removida nesta versão; não substituída por controles equivalentes a antivírus.

## Regra preservada
Nenhuma evidência ou comprovação em arquivo é disponibilizada enquanto `file_validation_status` não for `valid`.

## Consequências
Falha na validação estrutural impede associação e download. Downloads são autorizados no backend e entregues por URL assinada curta.
